// ─── coachResources.js ─────────────────────────────────────────────────
// V94.44 — bibliotheque de ressources reutilisables (PDFs/images) pour
// les messages d'Anissa a ses clientes.
//
// Anissa enregistre ici ses guides recurrents (anti-inflammatoire, sommeil,
// etc.) et les reselectionne dans le composer de message au lieu de re-coller
// l'URL+label a chaque fois.

// V96.35 : passe par le proxy server-side `/api/client-app-proxy`
import { clientAppFetch, ClientAppConfigError, ClientAppHttpError } from "./clientAppFetch";

export class CoachResourceError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CoachResourceError";
    this.status = status;
  }
}

function wrapErr(err) {
  if (err instanceof ClientAppConfigError) return new CoachResourceError(err.message, 0);
  if (err instanceof ClientAppHttpError) return new CoachResourceError(err.message, err.status);
  return err;
}

/** Liste les ressources actives (non archivees) — recents en premier. */
export async function fetchCoachResources({ includeArchived = false } = {}) {
  let payload;
  try {
    payload = await clientAppFetch("/api/admin/coach-resources", {
      method: "GET",
      query: includeArchived ? { include_archived: 1 } : null,
    });
  } catch (e) { throw wrapErr(e); }
  if (!payload?.ok) throw new CoachResourceError(payload?.error || payload?.message || "Reponse invalide", 0);
  return Array.isArray(payload.resources) ? payload.resources : [];
}

/** Cree une ressource. */
export async function createCoachResource({ label, url, type }) {
  const trimmedLabel = String(label || "").trim();
  const trimmedUrl = String(url || "").trim();
  if (!trimmedLabel) throw new CoachResourceError("Libelle requis", 0);
  if (trimmedLabel.length > 100) throw new CoachResourceError("Libelle trop long (max 100)", 0);
  if (!trimmedUrl) throw new CoachResourceError("URL requise", 0);
  if (!/^https:\/\//i.test(trimmedUrl)) throw new CoachResourceError("URL doit etre HTTPS", 0);
  if (type !== "pdf" && type !== "image") {
    throw new CoachResourceError("Type doit etre 'pdf' ou 'image'", 0);
  }

  let payload;
  try {
    payload = await clientAppFetch("/api/admin/coach-resources", {
      method: "POST",
      payload: { label: trimmedLabel, url: trimmedUrl, type },
    });
  } catch (e) { throw wrapErr(e); }
  if (!payload?.ok) throw new CoachResourceError(payload?.error || payload?.message || "Reponse invalide", 0);
  return payload.resource;
}

/** Archive une ressource (soft delete). */
export async function archiveCoachResource(id) {
  if (!id) throw new CoachResourceError("ID requis", 0);

  let payload;
  try {
    payload = await clientAppFetch("/api/admin/coach-resources", { method: "DELETE", query: { id } });
  } catch (e) { throw wrapErr(e); }
  if (!payload?.ok) throw new CoachResourceError(payload?.error || payload?.message || "Reponse invalide", 0);
  return payload.resource;
}
