// ─── sendCoachMessage.js ─────────────────────────────────────────────
// Envoie un message d'Anissa vers la cliente dans son app (in-app).
// Réutilise les mêmes env vars que publish/enrich (ADMIN_INVITE_SECRET).

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

export class CoachMessageError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CoachMessageError";
    this.status = status;
  }
}

/**
 * @param {object} params
 * @param {string} params.email   - email de la cliente (résolu côté serveur)
 * @param {string} params.body    - contenu du message (1-2000 chars)
 * @param {"manual"|"ai_assisted"} [params.source="manual"]
 * @returns {Promise<object>}     - le message persisté
 */
export async function sendCoachMessage({ email, body, source = "manual" }) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new CoachMessageError("Config app cliente manquante (.env.local)", 0);
  }
  if (!email) throw new CoachMessageError("Cliente sans email", 0);
  const trimmed = String(body || "").trim();
  if (!trimmed) throw new CoachMessageError("Message vide", 0);
  if (trimmed.length > 2000) throw new CoachMessageError("Message trop long (max 2000)", 0);

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/coach-message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email, body: trimmed, source }),
    });
  } catch (e) {
    throw new CoachMessageError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* */ }

  if (!res.ok || !payload?.ok) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw new CoachMessageError(msg, res.status);
  }
  return payload.message;
}
