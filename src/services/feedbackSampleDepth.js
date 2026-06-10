// ─── feedbackSampleDepth.js ─────────────────────────────────────────────
// P2.3 (remède sécurité clinique, 2026-06-10) — rendre VISIBLE la profondeur
// d'échantillon qui fonde la suggestion de transition de phase.
//
// Type C : la suggestion d'AVANCER le protocole (« la cliente semble prête pour
// la phase suivante ») s'appuyait sur N ressentis positifs récents, mais
// affichait un booléen — Anissa ne voyait pas SUR QUOI reposait la
// recommandation. On expose le nombre au lieu de le cacher.
//
// Remède = TRANSPARENCE, PAS verrouillage : on ne remonte PAS le seuil de
// déclenchement (décision clinique d'Anissa) ; on rend seulement la base
// chiffrée visible pour qu'elle décide en connaissance de cause.
//
// Le seuil lui-même reste dans le code applicatif appelant (et reste à valider
// par Anissa) — ce module ne décide rien, il compte.

const DAY_MS = 86400000;
const DEFAULT_WINDOW_DAYS = 7;

/**
 * Compte les ressentis « positifs » (digestion/fatigue 'better' ou energie
 * 'good') tombant dans la fenêtre des N derniers jours.
 *
 * @param {Array} feedbacks
 * @param {{ windowDays?: number, now?: number }} [options]
 * @returns {number}
 */
export function countRecentPositiveFeedbacks(feedbacks, options = {}) {
  if (!Array.isArray(feedbacks)) return 0;
  const windowDays =
    typeof options.windowDays === 'number' ? options.windowDays : DEFAULT_WINDOW_DAYS;
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const cutoff = now - windowDays * DAY_MS;

  return feedbacks.filter((f) => {
    if (!f) return false;
    const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
    if (Number.isNaN(ts) || ts < cutoff) return false;
    return f.digestion === 'better' || f.fatigue === 'better' || f.energie === 'good';
  }).length;
}

/**
 * Phrase de transparence affichée sous la suggestion de transition.
 * Vide si count <= 0 (on n'écrit jamais « 0 ressenti »).
 *
 * @param {number} count
 * @returns {string}
 */
export function formatPositiveSampleBasis(count) {
  if (!(count > 0)) return '';
  const plural = count > 1 ? 's' : '';
  return `sur la base de ${count} ressenti${plural} positif${plural} cette semaine`;
}
