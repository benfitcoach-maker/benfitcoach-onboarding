// ─── fetchClientsStatus.js ──────────────────────────────────────────────
// Récupère en 1 seul HTTP le statut "Invitée / Connectée / Active" pour
// une liste de clientes. Cache mémoire 60s pour éviter de re-fetcher
// pendant qu'Anissa scroll/filtre.
//
// Statut "absent" = la cliente n'a pas encore d'app activée (Anissa n'a
// pas publié son plan dans l'app cliente). Affiché en discret côté UI.
//
// V94.66 : input = liste d'objets { email, stagingClientId? } pour
// supporter le matching robuste par client_id (App Store/Play Store où
// l'email Apple/Google peut différer de l'email du SaaS via
// hide-my-email). Si stagingClientId est connu, on l'envoie au backend
// en client_ids[] et on indexe la réponse par stagingClientId. Sinon on
// fallback sur le lookup historique par email.
// L'ancien input string[] reste accepté (rétrocompat).

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

const CACHE_TTL_MS = 60 * 1000;
// Cache key composite : "id:<stagingClientId>" prioritaire, sinon
// "email:<email>". Permet aux 2 méthodes de coexister sans collision et
// d'éviter qu'une lookup "email" périmée écrase une lookup "id" fraîche.
const cache = new Map(); // cacheKey -> { entry, ts }

/** Vide le cache (utile pour debug / tests). */
export function clearStatusCache() {
  cache.clear();
}

/** Normalise un input mixte (strings ou objets) en {email, stagingClientId}. */
function normalizeInput(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items) {
    if (it == null) continue;
    if (typeof it === "string") {
      const email = it.trim().toLowerCase();
      if (email) out.push({ email, stagingClientId: null });
    } else if (typeof it === "object") {
      const email = String(it.email || "").trim().toLowerCase();
      const stagingClientId = it.stagingClientId
        ? String(it.stagingClientId).trim()
        : null;
      if (email || stagingClientId) {
        out.push({ email: email || null, stagingClientId: stagingClientId || null });
      }
    }
  }
  return out;
}

function cacheKeyFor(item) {
  if (item.stagingClientId) return `id:${item.stagingClientId}`;
  if (item.email) return `email:${item.email}`;
  return null;
}

/**
 * @param {Array<string | { email?: string, stagingClientId?: string }>} items
 * @returns {Promise<Record<string, object>>} map keyed by lowercased email
 *   (et aussi par stagingClientId si fourni) → { status, last_login_at, ... }
 *
 *   Pour rester rétrocompat avec les consommateurs existants, le résultat
 *   contient les entrées indexées par email ; pour les items qui n'ont pas
 *   d'email mais juste un stagingClientId, l'entrée est aussi accessible
 *   via la clé `id:<stagingClientId>`.
 */
export async function fetchClientsStatus(items) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) return {};

  const normalized = normalizeInput(items);
  if (normalized.length === 0) return {};

  // 1. Sépare ce qu'on a déjà en cache
  const now = Date.now();
  const result = {};
  const toFetch = [];
  for (const item of normalized) {
    const key = cacheKeyFor(item);
    if (!key) continue;
    const cached = cache.get(key);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      if (item.email) result[item.email] = cached.entry;
      result[key] = cached.entry;
    } else {
      toFetch.push(item);
    }
  }
  if (toFetch.length === 0) return result;

  // 2. Construit le payload : client_ids[] prioritaires (matching robuste),
  //    emails[] en fallback pour les clientes sans staging id connu.
  const clientIdsToFetch = [];
  const emailsToFetch = [];
  for (const item of toFetch) {
    if (item.stagingClientId) clientIdsToFetch.push(item.stagingClientId);
    else if (item.email) emailsToFetch.push(item.email);
  }

  const payload = {};
  if (emailsToFetch.length > 0) payload.emails = emailsToFetch;
  if (clientIdsToFetch.length > 0) payload.client_ids = clientIdsToFetch;

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/clients-status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // network error → on renvoie ce qu'on a (en cache + vide pour le reste)
    return result;
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }
  if (!res.ok || !body?.ok) return result;

  const statuses = (body.statuses && typeof body.statuses === "object") ? body.statuses : {};
  const statusesById = (body.statuses_by_id && typeof body.statuses_by_id === "object")
    ? body.statuses_by_id
    : {};

  const ABSENT = {
    status: "absent",
    last_login_at: null,
    last_activity_at: null,
    last_reviewed_at: null,
    feedbacks_7d_count: 0,
    new_feedbacks_count: 0,
    found: false,
  };

  function harden(entry) {
    const e = entry || { ...ABSENT };
    if (typeof e.feedbacks_7d_count !== "number") e.feedbacks_7d_count = 0;
    if (typeof e.new_feedbacks_count !== "number") e.new_feedbacks_count = 0;
    if (e.last_reviewed_at === undefined) e.last_reviewed_at = null;
    return e;
  }

  // 3. Cache + merge. Pour chaque item, on prend la lookup id en priorité
  //    (plus fiable), avec fallback sur email.
  for (const item of toFetch) {
    let entry = null;
    if (item.stagingClientId && statusesById[item.stagingClientId]) {
      entry = statusesById[item.stagingClientId];
    } else if (item.email && statuses[item.email]) {
      entry = statuses[item.email];
    }
    entry = harden(entry);

    const key = cacheKeyFor(item);
    if (key) cache.set(key, { entry, ts: now });

    if (item.email) result[item.email] = entry;
    if (key) result[key] = entry;
  }
  return result;
}
