// ─── publishToClientApp ────────────────────────────────────────────────
// Bridge SaaS → app cliente (anissa-client-preview).
//
// Construit le ClientPlan via le mapper local (déjà validé sur vraie data),
// puis POST l'endpoint admin /api/admin/publish-plan de l'app cliente.
//
// Variables d'env (côté SaaS, prefix VITE_) :
//   VITE_CLIENT_APP_API_URL       — ex. https://anissa-client-app.vercel.app
//   VITE_CLIENT_APP_ADMIN_SECRET  — Bearer token (= ADMIN_INVITE_SECRET de l'app cliente)
//
// Le secret est exposé dans le bundle Vite (VITE_*), ce qui est acceptable ici
// car le SaaS lui-même est protégé par auth (LoginScreen) et n'est pas
// déployé en accès public.

import { buildClientAppPlanFromConsultation } from "./clientAppMapper";
import { applyEnrichmentToPlan } from "./aiEnrichClientPlan";

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  // Vite expose les variables via import.meta.env
  return import.meta.env?.[key];
}

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

/** Vérifie que la config minimale est présente sans rien envoyer. */
export function checkPublishConfig() {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  const issues = [];
  if (!apiUrl) issues.push(`Variable d'env manquante : ${ENV_API_URL}`);
  if (!secret) issues.push(`Variable d'env manquante : ${ENV_SECRET}`);
  return { ok: issues.length === 0, issues };
}

/** Vérifie qu'on a tout ce qu'il faut sur la cliente avant publication. */
export function checkClientReadyForPublish(client, consultation) {
  const issues = [];
  const email = resolveClientEmail(client);
  if (!email) issues.push("Cliente sans email — ajoute son email dans la fiche.");
  if (!client?.prenom?.trim()) issues.push("Cliente sans prénom.");
  if (!consultation?.nutrition_plan?.trim()) {
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
 * @returns {Promise<object>}   - { ok, plan_id, status, published_version, login_url, ... }
 */
export async function publishConsultationToClientApp(client, consultation, enrichment = null) {
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

  // 3. Construit le plan via le mapper local + applique l'enrichissement IA
  // si fourni (Anissa l'a explicitement validé via le bouton "Utiliser").
  const basePlan = buildClientAppPlanFromConsultation(client, consultation);
  const plan = enrichment ? applyEnrichmentToPlan(basePlan, enrichment) : basePlan;

  // 4. POST l'endpoint admin
  const apiUrl = getEnv(ENV_API_URL).replace(/\/+$/, "");
  const secret = getEnv(ENV_SECRET);

  const payload = {
    email: ready.email,
    first_name: client.prenom?.trim() || "Cliente",
    mode: plan.mode,
    locale: plan.locale,
    title: plan.title,
    objective: plan.objective,
    source_consultation_id: consultation.id,
    nutrition_plan: consultation.nutrition_plan,
    sections: plan.sections,
  };

  let res;
  try {
    res = await fetch(`${apiUrl}/api/admin/publish-plan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new PublishHttpError(
      `Erreur réseau : ${err?.message || err}`,
      0,
      null,
    );
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // body non-JSON — on garde body=null
  }

  if (!res.ok || !body?.ok) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new PublishHttpError(msg, res.status, body);
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
