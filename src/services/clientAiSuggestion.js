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

// V96.35 : passe par le proxy server-side `/api/client-app-proxy`
import { clientAppFetch, ClientAppConfigError, ClientAppHttpError } from "./clientAppFetch";

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

function wrapErr(err) {
  if (err instanceof ClientAppConfigError) return new AiSuggestionError(err.message, 0);
  if (err instanceof ClientAppHttpError) return new AiSuggestionError(err.message, err.status);
  return err;
}

/**
 * GET la dernière suggestion enregistrée pour cette cliente.
 */
export async function fetchLatestAiSuggestion(client) {
  const email = resolveClientEmail(client);
  if (!email) return { ok: false, error: "Cliente sans email" };

  let body;
  try {
    body = await clientAppFetch("/api/admin/client-ai-suggestion", { method: "GET", query: { email } });
  } catch (e) {
    return { ok: false, error: e?.message || "Erreur reseau" };
  }
  if (!body?.ok) {
    return { ok: false, error: body?.error || "Reponse invalide" };
  }
  return {
    ok: true,
    suggestion: body.suggestion ?? null,
    is_stale: !!body.is_stale,
  };
}

/**
 * POST une nouvelle suggestion (sauvegarde post-call Claude).
 */
export async function saveAiSuggestion(client, consultation, suggestion) {
  const email = resolveClientEmail(client);
  if (!email) throw new AiSuggestionError("Cliente sans email", 0);

  // plan_id côté SaaS Anissa = consultation.id ? Non — c'est le plan_id
  // côté staging app cliente, qu'on ne connaît pas directement.

  const payload = {
    email,
    plan_id: null,
    summary: suggestion?.summary ?? null,
    suggestions: suggestion?.suggestions ?? null,
    coach_note: suggestion?.coach_note ?? null,
  };

  let body;
  try {
    body = await clientAppFetch("/api/admin/client-ai-suggestion", { method: "POST", payload });
  } catch (e) { throw wrapErr(e); }
  if (!body?.ok) throw new AiSuggestionError(body?.error || "Reponse invalide", 0);
  return body.suggestion;
}
