// ─── publishToClientApp ────────────────────────────────────────────────
// Bridge SaaS → app cliente (anissa-client-preview).
//
// Construit le ClientPlan via le mapper local (déjà validé sur vraie data),
// puis POST l'endpoint admin /api/admin/publish-plan de l'app cliente.
//
// V96.35 : passe par le proxy server-side `/api/client-app-proxy` au lieu
// d'appeler directement l'app cliente avec un Bearer token. Le secret
// VITE_CLIENT_APP_ADMIN_SECRET (qui était inliné dans le bundle JS public)
// vit maintenant côté serveur uniquement (process.env.CLIENT_APP_ADMIN_SECRET).

import { buildClientAppPlanFromConsultation } from "./clientAppMapper";
import { applyEnrichmentToPlan } from "./aiEnrichClientPlan";
import { saveClient } from "../store";
import { clientAppFetch, checkClientAppConfig, ClientAppConfigError, ClientAppHttpError } from "./clientAppFetch";
import { assertPlanClinicallyCleared } from "./clinicalClearance";

/** Récupère l'email de la cliente depuis ses données SaaS. */
function resolveClientEmail(client) {
  return (
    client?.form?.email ||
    client?.email ||
    null
  );
}

export class PublishConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublishConfigError";
  }
}

export class PublishHttpError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "PublishHttpError";
    this.status = status;
    this.payload = payload;
  }
}

// P1.2 (remède sécurité clinique) — la publication est l'une des 4 portes de
// sortie du plan. Le gate vit ICI (service), pas seulement dans l'UI, pour que
// les 3 call sites (ClientAppPreviewModal, ClientJourneyPage, PendingDraftsPanel)
// soient couverts par une seule barrière — défense en profondeur. Override
// conscient via options.clinicalOverride (l'UI le positionne après un confirm).
export class PublishClinicalError extends Error {
  constructor(verdict) {
    super("Clairance clinique refusée — plan bloqué à la publication.");
    this.name = "PublishClinicalError";
    this.verdict = verdict;
  }
}

/** Vérifie que la config minimale est présente sans rien envoyer. */
export function checkPublishConfig() {
  return checkClientAppConfig();
}

/** Vérifie qu'on a tout ce qu'il faut sur la cliente avant publication. */
export function checkClientReadyForPublish(client, consultation) {
  const issues = [];
  const email = resolveClientEmail(client);
  if (!email) issues.push("Cliente sans email — ajoute son email dans la fiche.");
  if (!client?.prenom?.trim()) issues.push("Cliente sans prénom.");
  // V97.13.28 — fix casing : accepte nutrition_plan (snake) OU nutritionPlan (camel)
  const planText = consultation?.nutrition_plan
    || consultation?.nutritionPlan
    || consultation?.plan_text
    || '';
  if (!planText.trim()) {
    issues.push("Consultation sans plan nutrition (rien à publier).");
  }
  return { ok: issues.length === 0, issues, email };
}

/**
 * Publie une consultation vers l'app cliente.
 *
 * @param {object} client       - ligne `clients` du SaaS
 * @param {object} consultation - ligne `nutrition_consultations` (état courant)
 * @param {object|null} [enrichment] - enrichissement IA accepté par Anissa (optionnel).
 *                                     Si fourni, mergé sur le plan avant publication.
 * @param {object} [options] - V96.0 options gating temporel :
 *   - effectiveAtOverride: ISO string pour forcer une date d'effet (override
 *     "Publier maintenant" sur un suivi). Si absent, l'API calcule depuis
 *     consultation.followupWeek.
 * @returns {Promise<object>}   - { ok, plan_id, status, published_version, effective_at, login_url, ... }
 */
export async function publishConsultationToClientApp(client, consultation, enrichment = null, options = {}) {
  // 1. Vérif config
  const cfg = checkPublishConfig();
  if (!cfg.ok) {
    throw new PublishConfigError(cfg.issues.join(" • "));
  }

  // 2. Vérif données cliente
  const ready = checkClientReadyForPublish(client, consultation);
  if (!ready.ok) {
    throw new PublishConfigError(ready.issues.join(" • "));
  }

  // 2bis. P1.2 — Clairance clinique (fail-closed). Bloque la publication d'un
  // plan présentant une violation HIGH (allergène, phrase interdite, interaction
  // contre-indiquée) sauf override conscient explicite de l'UI.
  const planTextForClearance = consultation?.nutrition_plan
    || consultation?.nutritionPlan
    || consultation?.plan_text
    || '';
  const clearance = assertPlanClinicallyCleared(planTextForClearance, { form: client?.form });
  if (!clearance.cleared && !options?.clinicalOverride) {
    throw new PublishClinicalError(clearance);
  }

  // 3. Construit le plan via le mapper local + applique l'enrichissement IA
  // si fourni (Anissa l'a explicitement validé via le bouton "Utiliser").
  const basePlan = buildClientAppPlanFromConsultation(client, consultation);
  const plan = enrichment ? applyEnrichmentToPlan(basePlan, enrichment) : basePlan;

  // 4. POST l'endpoint admin via proxy V96.35
  // V96.0 : gating temporel.
  // - followup_week derive de consultation.followupWeek (0=initial, 1-4=suivis)
  //   → l'API calcule effective_at = first_plan.published_at + week × 28j.
  // - effectiveAtOverride en cas d'override explicite ("Publier maintenant").
  const followupWeek = Number(consultation?.followupWeek) || 0;

  const payload = {
    email: ready.email,
    first_name: client.prenom?.trim() || "Cliente",
    mode: plan.mode,
    locale: plan.locale,
    title: plan.title,
    objective: plan.objective,
    source_consultation_id: consultation.id,
    // V97.13.28 — fix casing : accepte les 2 conventions du store local et Supabase
    nutrition_plan: consultation.nutrition_plan || consultation.nutritionPlan || '',
    sections: plan.sections,
    // V97.17.7.1 — Phase C : transmettre journey_phases pour que la tab Methode
    // de l'app cliente puisse afficher la timeline 5 phases. Oubli initial du
    // pipeline V97.17.0 : le mapper exposait journey_phases mais publishToClientApp
    // ne le transmettait pas dans le payload.
    journey_phases: plan.journey_phases || null,
    // V96.0
    followup_week: followupWeek,
    ...(options?.effectiveAtOverride
      ? { effective_at_override: options.effectiveAtOverride }
      : {}),
  };

  let body;
  try {
    body = await clientAppFetch("/api/admin/publish-plan", { method: "POST", payload });
  } catch (err) {
    if (err instanceof ClientAppConfigError) throw new PublishConfigError(err.message);
    if (err instanceof ClientAppHttpError) throw new PublishHttpError(err.message, err.status, err.payload);
    throw err;
  }
  if (!body?.ok) {
    throw new PublishHttpError(body?.error || body?.message || "Reponse invalide", 0, body);
  }

  // V94.52 : trace SaaS-side de la publication. Permet a ClientAppPanel
  // de presumer que la cliente a acces a l'app meme si /api/admin/clients-status
  // retourne found:false (cache stale, email mismatch, etc.).
  try {
    if (client?.id) {
      const KEY = "bfc_published_client_ids";
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const set = new Set(Array.isArray(arr) ? arr : []);
      set.add(String(client.id));
      localStorage.setItem(KEY, JSON.stringify([...set]));
    }
  } catch {
    /* silent : pas grave si quota plein */
  }

  // V94.66 : persiste l'id staging (= clients.id cote app cliente) sur le
  // client SaaS local. Permet ensuite a fetchClientsStatus de matcher la
  // cliente directement par client_id, sans dependre de l'email — crucial
  // pour les comptes App Store / Play Store ou Apple/Google peuvent
  // remplacer l'email par hide-my-email.
  try {
    const stagingId = body?.client_id ? String(body.client_id) : null;
    if (stagingId && client?.id && client.stagingClientId !== stagingId) {
      saveClient({ id: client.id, stagingClientId: stagingId });
    }
  } catch {
    /* silent : la publication a reussi, le mapping local est best-effort */
  }

  return body;
}

/**
 * V94.52 : Verifie si une cliente a ete publiee au moins une fois cote SaaS.
 * Utilise par ClientAppPanel.OverviewTab pour determiner l'acces.
 */
export function hasBeenPublishedLocally(clientId) {
  if (!clientId) return false;
  try {
    const raw = localStorage.getItem("bfc_published_client_ids");
    if (!raw) return false;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.includes(String(clientId));
  } catch {
    return false;
  }
}

/**
 * V94.53 : Backfill automatique du flag local pour une cliente.
 * Appele quand on detecte qu'elle a ete publiee via un autre signal
 * (api found OU app_enabled). Evite de devoir re-publier manuellement
 * toutes les clientes existantes apres l'update V94.52.
 */
export function markPublishedLocally(clientId) {
  if (!clientId) return;
  try {
    const KEY = "bfc_published_client_ids";
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(arr) ? arr : []);
    if (!set.has(String(clientId))) {
      set.add(String(clientId));
      localStorage.setItem(KEY, JSON.stringify([...set]));
    }
  } catch {
    /* silent */
  }
}
