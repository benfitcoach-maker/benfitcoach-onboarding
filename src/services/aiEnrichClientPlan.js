// ─── aiEnrichClientPlan.js ──────────────────────────────────────────────
// Couche IA éditoriale pour l'app cliente Anissa.
//
// PRINCIPE : on n'envoie à l'IA QUE des données éditoriales déjà extraites
// par le mapper regex (titres de piliers, takeaways, prénom, objectif).
// Aucune donnée médicale brute, aucun complément, aucune dose. L'IA ne
// peut donc pas en inventer — elle ne les voit jamais.
//
// L'IA produit un bloc d'enrichissement (intro narrative, pull_quote,
// tailored_points, signature_phrase, intros de section) qu'Anissa valide
// AVANT publication. Si elle l'ignore, le plan est publié tel quel.
//
// V96.35 : passe par le proxy server-side `/api/client-app-proxy`
// (le secret VITE_CLIENT_APP_ADMIN_SECRET ne vit plus dans le bundle).

import { clientAppFetch, checkClientAppConfig, ClientAppConfigError, ClientAppHttpError } from "./clientAppFetch";

export class EnrichConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "EnrichConfigError";
  }
}

export class EnrichHttpError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "EnrichHttpError";
    this.status = status;
    this.payload = payload;
  }
}

/** Vérifie que l'API URL est configurée. */
export function checkEnrichConfig() {
  return checkClientAppConfig();
}

/** Construit les inputs SAFE pour l'IA depuis un ClientPlan déjà mappé.
 *  On extrait UNIQUEMENT ce qui est éditorial — pas les compléments, pas
 *  les repas, pas les valeurs numériques. L'IA ne voit que ça. */
function buildSafeInputs(plan, client) {
  const sections = plan?.sections || {};
  const strategy = sections.strategy_data || {};
  const pillars_summary = (strategy.pillars || []).map((p) => ({
    title: String(p.title || "").slice(0, 80),
    description: String(p.description || "").slice(0, 200),
  }));
  const takeaways = (strategy.takeaways || []).slice(0, 6).map((t) => String(t).slice(0, 200));

  return {
    prenom: client?.prenom?.trim() || "",
    objectif: plan?.objective || undefined,
    pillars_summary,
    takeaways,
    locale: plan?.locale || "fr",
    // contexte_neutre : optionnel, on n'en envoie pas pour l'instant pour
    // garantir qu'aucune donnée médicale ne fuite. Pourrait venir plus
    // tard d'un champ "notes éditoriales" rempli par Anissa.
  };
}

/**
 * Demande à l'IA d'enrichir le plan déjà construit.
 *
 * @param {object} plan   - ClientPlan retourné par buildClientAppPlanFromConsultation
 * @param {object} client - ligne `clients` du SaaS
 * @returns {Promise<object>} { intro_body, pull_quote, tailored_points, signature_phrase, section_intros }
 */
export async function enrichClientAppPlan(plan, client) {
  const cfg = checkEnrichConfig();
  if (!cfg.ok) throw new EnrichConfigError(cfg.issues.join(" • "));

  const inputs = buildSafeInputs(plan, client);
  if (!inputs.prenom) throw new EnrichConfigError("Cliente sans prénom — impossible d'enrichir.");
  if (!inputs.pillars_summary.length) {
    throw new EnrichConfigError("Pas de piliers détectés dans la stratégie — l'IA n'a pas assez de matière.");
  }

  let body;
  try {
    body = await clientAppFetch("/api/admin/enrich-plan", { method: "POST", payload: inputs });
  } catch (err) {
    if (err instanceof ClientAppConfigError) throw new EnrichConfigError(err.message);
    if (err instanceof ClientAppHttpError) throw new EnrichHttpError(err.message, err.status, err.payload);
    throw err;
  }
  if (!body?.ok) {
    throw new EnrichHttpError(body?.error || body?.message || "Reponse invalide", 0, body);
  }
  return body.enrichment;
}

/** Strip markdown bold/italic dans une string (l'IA en met parfois malgré
 *  le prompt — l'app cliente fait déjà l'italique via CSS). */
function stripMd(s) {
  return String(s || "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/(?<![*\w])\*([^*\n]+?)\*(?!\w)/g, "$1")
    .replace(/(?<![_\w])_([^_\n]+?)_(?!\w)/g, "$1")
    .trim();
}

function stripMdArray(arr) {
  return Array.isArray(arr) ? arr.map(stripMd).filter(Boolean) : arr;
}

/**
 * Applique un enrichissement IA sur un ClientPlan déjà construit.
 * Pure : ne mute pas le plan d'entrée. Strip systématiquement les markers
 * markdown que l'IA peut introduire (l'app cliente fait l'italique en CSS).
 *
 * @param {object} plan       - ClientPlan original (mapper regex)
 * @param {object} enrichment - résultat de enrichClientAppPlan()
 * @returns {object}          - nouveau ClientPlan avec enrichissement appliqué
 */
export function applyEnrichmentToPlan(plan, enrichment) {
  if (!enrichment) return plan;
  const sections = plan.sections || {};

  // Nettoyage défensif des champs textuels IA
  const introBody = stripMdArray(enrichment.intro_body);
  const pullQuote = stripMd(enrichment.pull_quote);
  const tailoredPoints = (enrichment.tailored_points || []).map((p) => ({
    id: p.id,
    title: stripMd(p.title),
    detail: stripMd(p.detail),
  }));
  const signaturePhrase = stripMdArray(enrichment.signature_phrase);
  const sectionIntros = enrichment.section_intros || {};
  const cleanIntros = {
    rotation: stripMd(sectionIntros.rotation),
    fridge: stripMd(sectionIntros.fridge),
    protocols: stripMd(sectionIntros.protocols),
  };

  return {
    ...plan,
    sections: {
      ...sections,
      intro_data: {
        ...(sections.intro_data || {}),
        ...(introBody.length ? { body: introBody } : {}),
        ...(pullQuote ? { pull_quote: pullQuote } : {}),
        ...(tailoredPoints.length ? { tailored_points: tailoredPoints } : {}),
      },
      strategy_data: {
        ...(sections.strategy_data || {}),
        ...(signaturePhrase.length ? { signature_phrase: signaturePhrase } : {}),
      },
      rotation_data: cleanIntros.rotation
        ? { ...(sections.rotation_data || {}), intro: cleanIntros.rotation }
        : sections.rotation_data,
      fridge_data: cleanIntros.fridge
        ? { ...(sections.fridge_data || {}), intro: cleanIntros.fridge }
        : sections.fridge_data,
      protocols_data: cleanIntros.protocols
        ? { ...(sections.protocols_data || {}), intro: cleanIntros.protocols }
        : sections.protocols_data,
    },
  };
}
