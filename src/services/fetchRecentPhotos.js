// V96.3 — Service SaaS pour le widget "Photos recentes" du dashboard Anissa.
// Appelle l'API admin de l'app cliente (anissa-client-preview).

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

const CACHE_TTL_MS = 30 * 1000; // 30s — Anissa veut du temps reel
let cache = null; // { photos, ts }

export function clearPhotosCache() {
  cache = null;
}

/**
 * Recupere les N dernieres photos toutes clientes confondues.
 * @param {number} limit - default 10
 * @returns {Promise<Array<{ id, client_id, client_first_name, client_email,
 *   meal_id, url, reaction, reacted_at, created_at }>>}
 */
export async function fetchRecentPhotos(limit = 10) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) return [];

  // Cache simple pour eviter de spam l'API au moindre re-render
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS && cache.limit >= limit) {
    return cache.photos.slice(0, limit);
  }

  let res;
  try {
    res = await fetch(
      `${apiUrl.replace(/\/+$/, "")}/api/admin/recent-photos?limit=${limit}`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${secret}` },
      },
    );
  } catch {
    return [];
  }

  if (!res.ok) return [];
  let body = null;
  try { body = await res.json(); } catch { /* */ }
  if (!body?.ok || !Array.isArray(body.photos)) return [];

  cache = { photos: body.photos, ts: now, limit };
  return body.photos;
}

/**
 * Set/clear la reaction d'Anissa sur une photo.
 * @param {string} photoId
 * @param {'heart'|'thumbs_up'|'fire'|'flower'|null} reaction
 * @returns {Promise<boolean>}
 */
export async function setPhotoReaction(photoId, reaction) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret || !photoId) return false;

  let res;
  try {
    res = await fetch(
      `${apiUrl.replace(/\/+$/, "")}/api/admin/photo-react`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ photo_id: photoId, reaction }),
      },
    );
  } catch {
    return false;
  }

  if (!res.ok) return false;
  // Invalide le cache pour que la prochaine fetchRecentPhotos remonte
  // l'etat a jour de la reaction
  clearPhotosCache();
  return true;
}
