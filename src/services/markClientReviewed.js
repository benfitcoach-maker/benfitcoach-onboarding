// ─── markClientReviewed ─────────────────────────────────────────────────
// Pose clients.last_reviewed_at = now() côté app cliente quand Anissa
// ouvre la fiche d'une cliente (auto-mark 3s après affichage du panel
// Ressenti).
//
// Sert au calcul "X nouveaux feedbacks depuis ta dernière visite" affiché
// sur le dashboard via ClientNewFeedbacksBadge.
//
// Cache mémoire 5 min : si Anissa rebondit sur la même cliente plusieurs
// fois en peu de temps, on évite de spammer l'endpoint.

const ENV_API_URL = "VITE_CLIENT_APP_API_URL";
const ENV_SECRET = "VITE_CLIENT_APP_ADMIN_SECRET";

function getEnv(key) {
  return import.meta.env?.[key];
}

function resolveClientEmail(client) {
  return client?.form?.email || client?.email || null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const recentMarks = new Map(); // email -> ts

export class MarkReviewedError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "MarkReviewedError";
    this.status = status;
  }
}

/**
 * @param {object} client - ligne `clients` du SaaS (avec form.email)
 * @returns {Promise<{ ok: boolean, marked?: boolean, reason?: string }>}
 */
export async function markClientReviewed(client) {
  const apiUrl = getEnv(ENV_API_URL);
  const secret = getEnv(ENV_SECRET);
  if (!apiUrl || !secret) {
    return { ok: false, reason: "Config app cliente manquante (.env.local)" };
  }
  const email = resolveClientEmail(client);
  if (!email) return { ok: false, reason: "Cliente sans email" };

  // Cache : si on a marqué cette cliente il y a < 5 min, no-op
  const now = Date.now();
  const lastMark = recentMarks.get(email);
  if (lastMark && now - lastMark < CACHE_TTL_MS) {
    return { ok: true, marked: false, reason: "cached" };
  }

  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/admin/client-mark-reviewed`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email }),
    });
  } catch (e) {
    return { ok: false, reason: `Erreur réseau : ${e?.message || e}` };
  }

  let body = null;
  try { body = await res.json(); } catch { /* */ }

  if (!res.ok || !body?.ok) {
    return { ok: false, reason: body?.error || `HTTP ${res.status}` };
  }

  // Cache même si "not_found" pour pas re-spammer.
  recentMarks.set(email, now);

  return { ok: true, marked: !!body.marked, reason: body.reason };
}

export function clearMarkReviewedCache() {
  recentMarks.clear();
}
