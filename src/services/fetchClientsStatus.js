// ─── fetchClientsStatus.js ──────────────────────────────────────────────
// Récupère en 1 seul HTTP le statut "Invitée / Connectée / Active" pour
// une liste de clientes (par email). Cache mémoire 60s pour éviter de
// re-fetcher pendant qu'Anissa scroll/filtre.
//
// Statut "absent" = la cliente n'a pas encore d'app activée (Anissa n'a
// pas publié son plan dans l'app cliente). Affiché en discret côté UI.

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // email -> { entry, ts }

/** Vide le cache (utile pour debug / tests). */
export function clearStatusCache() {
  cache.clear();
}

/**
 * @param {string[]} emails - liste d'emails (au moins 1, max 100)
 * @returns {Promise<Record<string, object>>} map email -> { status, last_login_at, last_activity_at, found }
 */
export async function fetchClientsStatus(emails) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) return {};

  const clean = (Array.isArray(emails) ? emails : [])
    .map((e) => String(e || "").trim().toLowerCase())
    .filter(Boolean);
  if (clean.length === 0) return {};

  // 1. Utilise le cache pour ce qu'on a déjà
  const now = Date.now();
  const result = {};
  const toFetch = [];
  for (const email of clean) {
    const cached = cache.get(email);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      result[email] = cached.entry;
    } else {
      toFetch.push(email);
    }
  }
  if (toFetch.length === 0) return result;

  // 2. Fetch le manquant en batch
  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/clients-status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ emails: toFetch }),
    });
  } catch {
    // network error → on renvoie ce qu'on a (en cache + vide pour le reste)
    return result;
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }
  if (!res.ok || !body?.ok || typeof body.statuses !== "object") return result;

  // 3. Cache + merge
  for (const email of toFetch) {
    const entry = body.statuses[email] || {
      status: "absent",
      last_login_at: null,
      last_activity_at: null,
      found: false,
    };
    cache.set(email, { entry, ts: now });
    result[email] = entry;
  }
  return result;
}
