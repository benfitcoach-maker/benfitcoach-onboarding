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
 * @param {string} [params.attachment_url]    - V94.43 : URL HTTPS d'un PDF/image
 * @param {string} [params.attachment_label]  - V94.43 : libellé affiché à la cliente (max 100)
 * @param {"pdf"|"image"} [params.attachment_type]  - V94.43 : type pour rendu icône
 * @returns {Promise<object>}     - le message persisté
 */
export async function sendCoachMessage({
  email,
  body,
  source = "manual",
  attachment_url = null,
  attachment_label = null,
  attachment_type = null,
}) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new CoachMessageError("Config app cliente manquante (.env.local)", 0);
  }
  if (!email) throw new CoachMessageError("Cliente sans email", 0);
  const trimmed = String(body || "").trim();
  if (!trimmed) throw new CoachMessageError("Message vide", 0);
  if (trimmed.length > 2000) throw new CoachMessageError("Message trop long (max 2000)", 0);

  // V94.43 : validation cote SaaS (UX clean avant requete reseau)
  const aUrl = attachment_url ? String(attachment_url).trim() : null;
  const aLabel = attachment_label ? String(attachment_label).trim() : null;
  const aType = attachment_type ? String(attachment_type).trim() : null;
  const anyAttachment = !!(aUrl || aLabel || aType);
  const allAttachment = !!(aUrl && aLabel && aType);
  if (anyAttachment && !allAttachment) {
    throw new CoachMessageError("Piece jointe : URL, libelle et type requis ensemble", 0);
  }
  if (allAttachment) {
    if (!/^https:\/\//i.test(aUrl)) {
      throw new CoachMessageError("URL piece jointe doit etre HTTPS", 0);
    }
    if (aLabel.length > 100) {
      throw new CoachMessageError("Libelle piece jointe trop long (max 100)", 0);
    }
    if (aType !== "pdf" && aType !== "image") {
      throw new CoachMessageError("Type piece jointe doit etre 'pdf' ou 'image'", 0);
    }
  }

  const payload = { email, body: trimmed, source };
  if (allAttachment) {
    payload.attachment_url = aUrl;
    payload.attachment_label = aLabel;
    payload.attachment_type = aType;
  }

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/coach-message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new CoachMessageError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let resp = null;
  try { resp = await res.json(); } catch { /* */ }

  if (!res.ok || !resp?.ok) {
    const msg = resp?.error || resp?.message || `HTTP ${res.status}`;
    throw new CoachMessageError(msg, res.status);
  }
  return resp.message;
}

/**
 * V94.43 : recupere l'historique des messages envoyes a une cliente.
 *
 * @param {object} params
 * @param {string} params.email   - email de la cliente
 * @param {number} [params.limit=20]
 * @returns {Promise<{messages: object[], total: number}>}
 */
export async function fetchCoachMessages({ email, limit = 20 }) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new CoachMessageError("Config app cliente manquante (.env.local)", 0);
  }
  if (!email) throw new CoachMessageError("Cliente sans email", 0);

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/coach-messages-history`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email, limit }),
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
  return {
    messages: Array.isArray(payload.messages) ? payload.messages : [],
    total: typeof payload.total === "number" ? payload.total : 0,
  };
}
