// ─── fetchClientFeedbacks.js ────────────────────────────────────────────
// Lit les feedbacks d'une cliente depuis l'app cliente (Supabase staging),
// pour affichage côté SaaS Anissa. Cross-domain → passe par l'endpoint
// admin /api/admin/client-feedbacks (Bearer ADMIN_INVITE_SECRET).
//
// Exporte aussi `summarizeFeedbacks()` : agrège la majorité par axe sur
// les N derniers jours pour affichage compact dans la fiche cliente.

// V96.35 : passe par le proxy server-side `/api/client-app-proxy`
import { clientAppFetch } from "./clientAppFetch";
// V97.40 (roadmap 1.2) : envoie email ET client_id (matching robuste hide-my-email)
import { clientIdentityFields, hasClientIdentity } from "./clientIdentity";

/**
 * @param {object} client - ligne `clients` du SaaS
 * @param {number} days   - 1-30, défaut 7
 * @returns {Promise<{ ok: boolean, feedbacks: array, found?: boolean, error?: string }>}
 */
export async function fetchClientFeedbacks(client, days = 7) {
  if (!hasClientIdentity(client)) {
    return { ok: false, feedbacks: [], error: "Cliente sans email ni client_id" };
  }

  let body;
  try {
    body = await clientAppFetch("/api/admin/client-feedbacks", { method: "GET", query: { ...clientIdentityFields(client), days } });
  } catch (e) {
    return { ok: false, feedbacks: [], error: e?.message || "Erreur reseau" };
  }
  if (!body?.ok) {
    return { ok: false, feedbacks: [], error: body?.error || "Reponse invalide" };
  }
  return {
    ok: true,
    found: !!body.found,
    feedbacks: body.feedbacks || [],
    current_plan_id: body.current_plan_id ?? null,
    current_plan_published_at: body.current_plan_published_at ?? null,
    previous_plan_id: body.previous_plan_id ?? null,
    previous_plan_published_at: body.previous_plan_published_at ?? null,
    previous_feedbacks: body.previous_feedbacks || [],
  };
}

// ─── Agrégation 7 jours ─────────────────────────────────────────────────
//
// Pour chaque axe, on prend la valeur majoritaire (en cas d'égalité, on
// privilégie la valeur la plus récente). On collecte aussi les notes pour
// affichage en bas de carte.

const AXIS_VALUES = {
  fatigue:   ["better", "same", "worse"],
  digestion: ["better", "same", "worse"],
  faim:      ["low", "ok", "high"],
  energie:   ["low", "ok", "good"],
};

/**
 * @param {Array} feedbacks - liste triée date desc (le plus récent en 1er)
 */
export function summarizeFeedbacks(feedbacks) {
  if (!feedbacks?.length) return null;

  const counts = {
    fatigue:   { better: 0, same: 0, worse: 0 },
    digestion: { better: 0, same: 0, worse: 0 },
    faim:      { low: 0, ok: 0, high: 0 },
    energie:   { low: 0, ok: 0, good: 0 },
  };
  const mostRecent = { fatigue: null, digestion: null, faim: null, energie: null };
  const notes = [];

  for (const f of feedbacks) {
    for (const axis of Object.keys(counts)) {
      const v = f[axis];
      if (v && AXIS_VALUES[axis].includes(v)) {
        counts[axis][v] = (counts[axis][v] || 0) + 1;
        if (mostRecent[axis] === null) mostRecent[axis] = v;
      }
    }
    if (f.note?.trim()) {
      notes.push({ date: f.date, note: f.note.trim() });
    }
  }

  /** Renvoie la valeur majoritaire de l'axe — si égalité, la plus récente. */
  const majority = (axis) => {
    const c = counts[axis];
    const entries = Object.entries(c).filter(([, v]) => v > 0);
    if (!entries.length) return null;
    const max = Math.max(...entries.map(([, v]) => v));
    const top = entries.filter(([, v]) => v === max).map(([k]) => k);
    if (top.length === 1) return top[0];
    // égalité → on prend la valeur la plus récente parmi les ex æquo
    return top.includes(mostRecent[axis]) ? mostRecent[axis] : top[0];
  };

  // ─── Suivi du poids (optionnel, si Anissa a activé le tracking) ─
  // On ne fait PAS de moyenne — affiche juste la dernière valeur connue
  // côté SaaS pour qu'Anissa voie. La tendance arrivera plus tard si besoin.
  const weightEntries = feedbacks
    .filter((f) => typeof f.weight_kg === "number")
    .map((f) => ({ date: f.date, weight_kg: Number(f.weight_kg) }));
  const weightLast = weightEntries[0] || null;

  return {
    fatigue: majority("fatigue"),
    digestion: majority("digestion"),
    faim: majority("faim"),
    energie: majority("energie"),
    notes: notes.slice(0, 5),
    total_entries: feedbacks.length,
    last_date: feedbacks[0]?.date || null,
    weight_last: weightLast,
    weight_entries_count: weightEntries.length,
    counts, // utile pour debug ou affichage détaillé
  };
}
