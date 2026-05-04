// ─── sendCoachMessage.js ─────────────────────────────────────────────
// Envoie un message d'Anissa vers la cliente dans son app (in-app).
// V96.35 : passe par le proxy server-side `/api/client-app-proxy`.

import { clientAppFetch, ClientAppConfigError, ClientAppHttpError } from "./clientAppFetch";

export class CoachMessageError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CoachMessageError";
    this.status = status;
  }
}

function wrapErr(err) {
  if (err instanceof ClientAppConfigError) return new CoachMessageError(err.message, 0);
  if (err instanceof ClientAppHttpError) return new CoachMessageError(err.message, err.status);
  return err;
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

  let resp;
  try {
    resp = await clientAppFetch("/api/admin/coach-message", { method: "POST", payload });
  } catch (e) { throw wrapErr(e); }
  if (!resp?.ok) throw new CoachMessageError(resp?.error || resp?.message || "Reponse invalide", 0);
  return resp.message;
}

/**
 * V96.6 : edite le body d'un message déjà envoyé.
 *
 * @param {object} params
 * @param {string} params.id    - id UUID du message
 * @param {string} params.body  - nouveau contenu (1-2000 chars)
 * @returns {Promise<object>} le message mis à jour
 */
export async function editCoachMessage({ id, body }) {
  if (!id) throw new CoachMessageError("Id message manquant", 0);
  const trimmed = String(body || "").trim();
  if (!trimmed) throw new CoachMessageError("Message vide", 0);
  if (trimmed.length > 2000) throw new CoachMessageError("Message trop long (max 2000)", 0);

  let resp;
  try {
    resp = await clientAppFetch("/api/admin/coach-message", { method: "PATCH", payload: { id, body: trimmed } });
  } catch (e) { throw wrapErr(e); }
  if (!resp?.ok) throw new CoachMessageError(resp?.error || resp?.message || "Reponse invalide", 0);
  return resp.message;
}

/**
 * V96.6 : supprime un message envoyé. Hard delete.
 *
 * @param {object} params
 * @param {string} params.id - id UUID du message
 * @returns {Promise<{deleted_id: string}>}
 */
export async function deleteCoachMessage({ id }) {
  if (!id) throw new CoachMessageError("Id message manquant", 0);

  let resp;
  try {
    resp = await clientAppFetch("/api/admin/coach-message", { method: "DELETE", query: { id } });
  } catch (e) { throw wrapErr(e); }
  if (!resp?.ok) throw new CoachMessageError(resp?.error || resp?.message || "Reponse invalide", 0);
  return { deleted_id: resp.deleted_id };
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
  if (!email) throw new CoachMessageError("Cliente sans email", 0);

  let payload;
  try {
    payload = await clientAppFetch("/api/admin/coach-messages-history", { method: "POST", payload: { email, limit } });
  } catch (e) { throw wrapErr(e); }
  if (!payload?.ok) throw new CoachMessageError(payload?.error || payload?.message || "Reponse invalide", 0);
  return {
    messages: Array.isArray(payload.messages) ? payload.messages : [],
    total: typeof payload.total === "number" ? payload.total : 0,
  };
}
