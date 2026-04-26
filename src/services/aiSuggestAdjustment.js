// ─── aiSuggestAdjustment.js ─────────────────────────────────────────────
// Aide à la décision IA pour Anissa : à partir des feedbacks cliente, l'IA
// propose des PISTES d'ajustement (jamais d'application automatique).
//
// SAFE BY CONSTRUCTION : on n'envoie à l'IA que des données déjà validées
// par Anissa (titres piliers, takeaways) + les feedbacks structurés.
// Aucun dosage, aucun complément, aucun repas n'est exposé.
//
// Anissa garde le dernier mot. L'IA ne peut JAMAIS modifier le plan.

import { buildClientAppPlanFromConsultation } from "./clientAppMapper";

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

export class SuggestConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "SuggestConfigError";
  }
}

export class SuggestHttpError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "SuggestHttpError";
    this.status = status;
    this.payload = payload;
  }
}

export function checkSuggestConfig() {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  const issues = [];
  if (!apiUrl) issues.push(`Variable d'env manquante : ${ENV_API_URL}`);
  if (!secret) issues.push(`Variable d'env manquante : ${ENV_SECRET}`);
  return { ok: issues.length === 0, issues };
}

/** Extrait les inputs SAFE pour l'IA. */
function buildSafeInputs(client, consultation, summary, ruleSignals) {
  const plan = buildClientAppPlanFromConsultation(client, consultation);
  const strategy = plan.sections?.strategy_data || {};

  return {
    plan: {
      objective: plan.objective || undefined,
      pillars: (strategy.pillars || []).map((p) => ({
        title: String(p.title || "").slice(0, 80),
        description: String(p.description || "").slice(0, 200),
      })),
      takeaways: (strategy.takeaways || []).slice(0, 6).map((t) => String(t).slice(0, 200)),
    },
    feedback_summary: summary,
    rule_signals: ruleSignals
      ? {
          readings: (ruleSignals.readings || []).map((r) => ({
            axis: r.axis,
            text: r.text,
            tone: r.tone,
          })),
          suggestions: (ruleSignals.suggestions || []).map((s) => ({
            axis: s.axis,
            level: s.level,
            message: s.message,
          })),
        }
      : null,
    locale: plan.locale || "fr",
  };
}

/**
 * @param {object} client       - ligne `clients` du SaaS
 * @param {object} consultation - ligne `nutrition_consultations`
 * @param {object} summary      - retour de summarizeFeedbacks()
 * @param {object|null} ruleSignals - retour optionnel de suggestAdjustments()
 * @returns {Promise<{ summary, suggestions[], coach_note }>}
 */
export async function aiSuggestAdjustment(client, consultation, summary, ruleSignals = null) {
  const cfg = checkSuggestConfig();
  if (!cfg.ok) throw new SuggestConfigError(cfg.issues.join(" • "));

  if (!summary || (!summary.fatigue && !summary.digestion && !summary.faim && !summary.energie)) {
    throw new SuggestConfigError("Pas assez de feedbacks pour suggérer un ajustement.");
  }

  const inputs = buildSafeInputs(client, consultation, summary, ruleSignals);
  if (!inputs.plan.pillars.length) {
    throw new SuggestConfigError("Pas de piliers détectés dans la stratégie — l'IA n'a pas assez de matière.");
  }

  const apiUrl = getEnv(ENV_API_URL).replace(/\/+$/, "");
  const secret = getEnv(ENV_SECRET);

  let res;
  try {
    res = await fetch(`${apiUrl}/api/admin/suggest-adjustment`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(inputs),
    });
  } catch (err) {
    throw new SuggestHttpError(`Erreur réseau : ${err?.message || err}`, 0, null);
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }

  if (!res.ok || !body?.ok) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new SuggestHttpError(msg, res.status, body);
  }
  return body.suggestion;
}
