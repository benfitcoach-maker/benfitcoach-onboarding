// ─── fetchClientSignals.js ────────────────────────────────────────────
// V94.45 — Recupere les signaux d'engagement d'une cliente :
// - upgrade_interests : clics CTA "Decouvrir le suivi 6 mois"
// - attachment_opens  : ouvertures des PDFs/images envoyes par Anissa
//
// Combine cote SaaS pour afficher dans l'onglet 'App cliente' > Signaux.

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

export class ClientSignalsError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ClientSignalsError";
    this.status = status;
  }
}

/**
 * @param {object} params
 * @param {string} params.email
 * @param {number} [params.limit=50]
 * @returns {Promise<{ upgrade_interests: object[], attachment_opens: object[] }>}
 */
export async function fetchClientSignals({ email, limit = 50 }) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new ClientSignalsError("Config app cliente manquante (.env.local)", 0);
  }
  if (!email) throw new ClientSignalsError("Cliente sans email", 0);

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/client-signals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email, limit }),
    });
  } catch (e) {
    throw new ClientSignalsError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* */ }

  if (!res.ok || !payload?.ok) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw new ClientSignalsError(msg, res.status);
  }

  return {
    upgrade_interests: Array.isArray(payload.upgrade_interests) ? payload.upgrade_interests : [],
    attachment_opens: Array.isArray(payload.attachment_opens) ? payload.attachment_opens : [],
  };
}
