// ─── clientAiSuggestion ─────────────────────────────────────────────────
// Persistence des suggestions IA générées par /api/admin/suggest-adjustment.
//
// Avant V90.0 : chaque clic sur "✨ Suggérer un ajustement (IA)" déclenchait
// un nouveau call Claude, et le résultat disparaissait dès qu'Anissa quittait
// la fiche. Frustration : devoir re-cliquer à chaque ouverture.
//
// V90.0 : on sauve la dernière suggestion en DB (table client_ai_suggestions).
// À l'ouverture du panel Ressenti, on charge la dernière connue. Anissa
// retrouve sa réflexion. Elle peut "Régénérer" pour appeler Claude à nouveau
// (ce qui crée une nouvelle entrée — historique préservé pour audit).
//
// is_stale = true si :
//   - suggestion > 7 jours
//   - OU au moins 1 nouveau feedback depuis (signal qui a changé)

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

function resolveClientEmail(client) {
  return client?.form?.email || client?.email || null;
}

export class AiSuggestionError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "AiSuggestionError";
    this.status = status;
  }
}

function getEnvOrThrow() {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new AiSuggestionError("Config app cliente manquante (.env.local)", 0);
  }
  return { apiUrl, secret };
}

/**
 * GET la dernière suggestion enregistrée pour cette cliente.
 * @param {object} client
 * @returns {Promise<{ ok: boolean, suggestion?: object | null, is_stale?: boolean, error?: string }>}
 */
export async function fetchLatestAiSuggestion(client) {
  let env;
  try { env = getEnvOrThrow(); } catch (e) { return { ok: false, error: e.message }; }

  const email = resolveClientEmail(client);
  if (!email) return { ok: false, error: "Cliente sans email" };

  const url = `${env.apiUrl.replace(/\/+$/, "")}/api/admin/client-ai-suggestion?email=${encodeURIComponent(email)}`;
  let res;
  try {
    res = await fetch(url, { headers: { authorization: `Bearer ${env.secret}` } });
  } catch (e) {
    return { ok: false, error: `Erreur réseau : ${e?.message || e}` };
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }

  if (!res.ok || !body?.ok) {
    return { ok: false, error: body?.error || `HTTP ${res.status}` };
  }

  return {
    ok: true,
    suggestion: body.suggestion ?? null,
    is_stale: !!body.is_stale,
  };
}

/**
 * POST une nouvelle suggestion (sauvegarde post-call Claude).
 * @param {object} client
 * @param {object} consultation - pour récupérer le plan_id si dispo
 * @param {object} suggestion - { summary, suggestions, coach_note }
 */
export async function saveAiSuggestion(client, consultation, suggestion) {
  let env;
  try { env = getEnvOrThrow(); } catch (e) { throw e; }

  const email = resolveClientEmail(client);
  if (!email) throw new AiSuggestionError("Cliente sans email", 0);

  // plan_id côté SaaS Anissa = consultation.id ? Non — c'est le plan_id
  // côté staging app cliente, qu'on ne connaît pas directement.
  // On laisse plan_id null pour l'instant. La mise en cohérence cross-DB
  // viendrait dans une V90.x dédiée.

  const payload = {
    email,
    plan_id: null,
    summary: suggestion?.summary ?? null,
    suggestions: suggestion?.suggestions ?? null,
    coach_note: suggestion?.coach_note ?? null,
  };

  let res;
  try {
    res = await fetch(`${env.apiUrl.replace(/\/+$/, "")}/api/admin/client-ai-suggestion`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.secret}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new AiSuggestionError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }
  if (!res.ok || !body?.ok) {
    throw new AiSuggestionError(body?.error || `HTTP ${res.status}`, res.status);
  }
  return body.suggestion;
}
