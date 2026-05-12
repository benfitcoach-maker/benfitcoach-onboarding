// V97.4 V3.F — Extraction de signaux microbiome depuis les données Anissa.
// Date : 2026-05-12
//
// Rôle : normaliser l'accès aux statuts marker microbiome saisis étape 4.
// Les règles (microbiomeRules.js) consomment ces helpers — elles ne
// connaissent pas la structure brute de journey_state.results_data.
//
// Source de vérité : journey_state.results_data.from_plan[].markers[]
// (V3.C). Chaque marker porte un status: 'prioritaire' | 'surveiller' |
// 'optimal' | null saisi manuellement par Anissa.
//
// On NE déduit RIEN du `value` brut (texte libre). Anissa a déjà fait
// l'interprétation via le `status`. C'est la garantie anti-surinterprétation.

/**
 * @typedef {'prioritaire' | 'surveiller' | 'optimal'} MarkerStatus
 */

/**
 * Construit un index marker_code → status[] à partir de from_plan.
 * Un même marker peut apparaître dans plusieurs tests (longitudinal V3.E),
 * donc on stocke un tableau de status.
 *
 * @param {Array} fromPlan - results_data.from_plan
 * @returns {Map<string, MarkerStatus[]>}
 */
export function getMarkerStatusIndex(fromPlan) {
  const idx = new Map();
  if (!Array.isArray(fromPlan)) return idx;

  for (const r of fromPlan) {
    if (!r || !Array.isArray(r.markers)) continue;
    for (const m of r.markers) {
      if (!m || !m.marker_code) continue;
      const status = m.status;
      if (status !== 'prioritaire' && status !== 'surveiller' && status !== 'optimal') continue;
      const arr = idx.get(m.marker_code) || [];
      arr.push(status);
      idx.set(m.marker_code, arr);
    }
  }
  return idx;
}

/**
 * Test : au moins un marker du code donné a un status parmi ceux fournis.
 *
 * @param {Map<string, MarkerStatus[]>} index - retour de getMarkerStatusIndex
 * @param {string} markerCode
 * @param {...MarkerStatus} statuses
 * @returns {boolean}
 */
export function hasMarkerWithStatus(index, markerCode, ...statuses) {
  if (!index || !markerCode || statuses.length === 0) return false;
  const arr = index.get(markerCode);
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some((s) => statuses.includes(s));
}

/**
 * Test : au moins UN marker parmi la liste a un status parmi ceux fournis.
 * Utile pour les règles "au moins un parmi {ferritine, zinc, b12} flaggué".
 *
 * @param {Map<string, MarkerStatus[]>} index
 * @param {string[]} markerCodes
 * @param {...MarkerStatus} statuses
 * @returns {boolean}
 */
export function anyMarkerWithStatus(index, markerCodes, ...statuses) {
  if (!index || !Array.isArray(markerCodes) || markerCodes.length === 0) return false;
  return markerCodes.some((code) => hasMarkerWithStatus(index, code, ...statuses));
}

/**
 * Compte des markers d'un set donné dont le status est dans la liste fournie.
 * Utile pour règle "≥ 2 markers inflammation flaggués prioritaire/surveiller".
 *
 * @param {Map<string, MarkerStatus[]>} index
 * @param {string[]} markerCodes
 * @param {...MarkerStatus} statuses
 * @returns {number}
 */
export function countMarkersWithStatus(index, markerCodes, ...statuses) {
  if (!index || !Array.isArray(markerCodes)) return 0;
  let n = 0;
  for (const code of markerCodes) {
    if (hasMarkerWithStatus(index, code, ...statuses)) n += 1;
  }
  return n;
}

/**
 * Liste des codes markers présents dans l'index (avec au moins un status).
 * Utile pour debug + audit reasons.
 *
 * @param {Map<string, MarkerStatus[]>} index
 * @returns {string[]}
 */
export function getKnownMarkerCodes(index) {
  if (!index) return [];
  return Array.from(index.keys());
}

/**
 * V97.4 V3.H Gap #1 — Extrait les signaux pression antibiotique depuis le form.
 *
 * Logique : retourne un objet booléen / numérique normalisé pour que les
 * règles microbiome n'aient pas à parser les valeurs brutes du form.
 *
 *   - hasRecentAntibiotics       : antibio dans les 12 derniers mois
 *   - hasVeryRecentAntibiotics   : antibio dans les 3 derniers mois (très fort signal)
 *   - hasHeavyAntibioticHistory  : 2+ cures sur 12 mois OU cure prolongée
 *   - hasRecentAntifungals       : antifongiques dans 12 mois (signal candida potentiel)
 *   - hasRecurrentInfections     : infections fréquentes ou occasionnelles
 *
 * Tout absent → retourne tous les flags à false (pas de signal).
 *
 * @param {object} form
 * @returns {{ hasRecentAntibiotics: boolean, hasVeryRecentAntibiotics: boolean,
 *            hasHeavyAntibioticHistory: boolean, hasRecentAntifungals: boolean,
 *            hasRecurrentInfections: boolean }}
 */
export function getFormAntibioticSignals(form) {
  const safe = form || {};
  const recents = safe.antibiotiques_recents;
  const freq = safe.antibiotiques_frequence_12mois;
  const antifongiques = safe.antifongiques_recents;
  const infections = safe.infections_recurrentes;

  const hasVeryRecentAntibiotics = recents === 'moins_3_mois';
  const hasRecentAntibiotics =
    recents === 'moins_3_mois' || recents === 'moins_12_mois';

  const hasHeavyAntibioticHistory =
    freq === '2_3_cures' || freq === '4_plus_cures';

  const hasRecentAntifungals = antifongiques === 'oui_12_mois';
  const hasRecurrentInfections =
    infections === 'occasionnelles' || infections === 'frequentes';

  return {
    hasRecentAntibiotics,
    hasVeryRecentAntibiotics,
    hasHeavyAntibioticHistory,
    hasRecentAntifungals,
    hasRecurrentInfections,
  };
}
