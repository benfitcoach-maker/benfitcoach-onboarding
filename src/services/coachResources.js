// ─── coachResources.js ─────────────────────────────────────────────────
// V94.44 — bibliotheque de ressources reutilisables (PDFs/images) pour
// les messages d'Anissa a ses clientes.
//
// Anissa enregistre ici ses guides recurrents (anti-inflammatoire, sommeil,
// etc.) et les reselectionne dans le composer de message au lieu de re-coller
// l'URL+label a chaque fois.

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

export class CoachResourceError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CoachResourceError";
    this.status = status;
  }
}

function getConfig() {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    throw new CoachResourceError("Config app cliente manquante (.env.local)", 0);
  }
  return { apiUrl: apiUrl.replace(/\/+$/, ""), secret };
}

/** Liste les ressources actives (non archivees) — recents en premier. */
export async function fetchCoachResources({ includeArchived = false } = {}) {
  const { apiUrl, secret } = getConfig();
  const qs = includeArchived ? "?include_archived=1" : "";

  let res;
  try {
    res = await fetch(`${apiUrl}/api/admin/coach-resources${qs}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${secret}`,
      },
    });
  } catch (e) {
    throw new CoachResourceError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* */ }

  if (!res.ok || !payload?.ok) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw new CoachResourceError(msg, res.status);
  }
  return Array.isArray(payload.resources) ? payload.resources : [];
}

/** Cree une ressource. */
export async function createCoachResource({ label, url, type }) {
  const { apiUrl, secret } = getConfig();

  const trimmedLabel = String(label || "").trim();
  const trimmedUrl = String(url || "").trim();
  if (!trimmedLabel) throw new CoachResourceError("Libelle requis", 0);
  if (trimmedLabel.length > 100) throw new CoachResourceError("Libelle trop long (max 100)", 0);
  if (!trimmedUrl) throw new CoachResourceError("URL requise", 0);
  if (!/^https:\/\//i.test(trimmedUrl)) throw new CoachResourceError("URL doit etre HTTPS", 0);
  if (type !== "pdf" && type !== "image") {
    throw new CoachResourceError("Type doit etre 'pdf' ou 'image'", 0);
  }

  let res;
  try {
    res = await fetch(`${apiUrl}/api/admin/coach-resources`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ label: trimmedLabel, url: trimmedUrl, type }),
    });
  } catch (e) {
    throw new CoachResourceError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* */ }

  if (!res.ok || !payload?.ok) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw new CoachResourceError(msg, res.status);
  }
  return payload.resource;
}

/** Archive une ressource (soft delete). */
export async function archiveCoachResource(id) {
  const { apiUrl, secret } = getConfig();
  if (!id) throw new CoachResourceError("ID requis", 0);

  let res;
  try {
    res = await fetch(`${apiUrl}/api/admin/coach-resources?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${secret}`,
      },
    });
  } catch (e) {
    throw new CoachResourceError(`Erreur réseau : ${e?.message || e}`, 0);
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* */ }

  if (!res.ok || !payload?.ok) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw new CoachResourceError(msg, res.status);
  }
  return payload.resource;
}
