// ─── fetchClientSignals.js ────────────────────────────────────────────
// V94.45 — Recupere les signaux d'engagement d'une cliente :
// - upgrade_interests : clics CTA "Decouvrir le suivi 6 mois"
// - attachment_opens  : ouvertures des PDFs/images envoyes par Anissa
//
// Combine cote SaaS pour afficher dans l'onglet 'App cliente' > Signaux.

// V96.35 : passe par le proxy server-side `/api/client-app-proxy`
import { clientAppFetch, ClientAppConfigError, ClientAppHttpError } from "./clientAppFetch";

export class ClientSignalsError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ClientSignalsError";
    this.status = status;
  }
}

function wrapErr(err) {
  if (err instanceof ClientAppConfigError) return new ClientSignalsError(err.message, 0);
  if (err instanceof ClientAppHttpError) return new ClientSignalsError(err.message, err.status);
  return err;
}

/**
 * @param {object} params
 * @param {string} params.email
 * @param {number} [params.limit=50]
 * @returns {Promise<{ upgrade_interests: object[], attachment_opens: object[] }>}
 */
export async function fetchClientSignals({ email, limit = 50 }) {
  if (!email) throw new ClientSignalsError("Cliente sans email", 0);

  let payload;
  try {
    payload = await clientAppFetch("/api/admin/client-signals", { method: "POST", payload: { email, limit } });
  } catch (e) { throw wrapErr(e); }
  if (!payload?.ok) throw new ClientSignalsError(payload?.error || payload?.message || "Reponse invalide", 0);

  return {
    upgrade_interests: Array.isArray(payload.upgrade_interests) ? payload.upgrade_interests : [],
    attachment_opens: Array.isArray(payload.attachment_opens) ? payload.attachment_opens : [],
  };
}
