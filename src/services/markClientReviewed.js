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

// V96.35 : passe par le proxy server-side `/api/client-app-proxy`
import { clientAppFetch } from "./clientAppFetch";

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
  const email = resolveClientEmail(client);
  if (!email) return { ok: false, reason: "Cliente sans email" };

  // Cache : si on a marqué cette cliente il y a < 5 min, no-op
  const now = Date.now();
  const lastMark = recentMarks.get(email);
  if (lastMark && now - lastMark < CACHE_TTL_MS) {
    return { ok: true, marked: false, reason: "cached" };
  }

  let body;
  try {
    body = await clientAppFetch("/api/admin/client-mark-reviewed", { method: "POST", payload: { email } });
  } catch (e) {
    return { ok: false, reason: e?.message || "Erreur reseau" };
  }
  if (!body?.ok) {
    return { ok: false, reason: body?.error || "Reponse invalide" };
  }

  // Cache même si "not_found" pour pas re-spammer.
  recentMarks.set(email, now);

  return { ok: true, marked: !!body.marked, reason: body.reason };
}

export function clearMarkReviewedCache() {
  recentMarks.clear();
}
