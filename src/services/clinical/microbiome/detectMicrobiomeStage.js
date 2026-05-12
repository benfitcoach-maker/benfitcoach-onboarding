// V97.4 V3.F — Moteur de détection de phase microbiome.
// Date : 2026-05-12
//
// Stratégie : SUGGESTIVE, JAMAIS PRESCRIPTIVE.
//
// Algorithme :
//   1. Extraire les statuts marker depuis from_plan[].markers[]
//   2. Évaluer chaque règle déclarative (microbiomeRules.js)
//   3. Agréger les votes par phase
//   4. Phase gagnante = max vote, MAIS seulement si :
//        - le total est ≥ MIN_VOTES_THRESHOLD (sinon null)
//        - aucune autre phase n'est trop proche (sinon discordance → null)
//   5. Confidence dérivée du total + écart avec le runner-up
//   6. Override Anissa lu depuis journey_state.microbiome_override
//      → final_phase écrasée, mais inferred_phase + reasons conservés (audit)
//
// Ne throw jamais. Retourne toujours un objet (avec phase null si rien).

import { getMarkerStatusIndex } from './microbiomeSignals';
import { MICROBIOME_RULES } from './microbiomeRules';
import { getPhase } from './phases';

// Seuils conservateurs. Mieux vaut "pas de phase" qu'une fausse inférence.
const MIN_VOTES_THRESHOLD = 2;       // total votes pour la phase gagnante
const DISCORDANCE_MARGIN = 1;         // si runner-up est à ≤1 vote du leader, discordance

/**
 * @typedef {Object} MicrobiomeStageOutput
 * @property {number|null} inferred_phase           - phase auto-détectée (1-5 ou null)
 * @property {number|null} final_phase              - phase finale (= override si présent)
 * @property {'forte'|'modérée'|'faible'|null} confidence
 * @property {boolean} overridden_by_practitioner
 * @property {string|null} override_reason
 * @property {string[]} reasons                     - raisons audit (règles déclenchées)
 * @property {string[]} target_markers              - markers à surveiller pour la phase finale
 * @property {string[]} allowed_axes                - axes cliniques compatibles
 * @property {string[]} avoid_axes                  - axes à éviter
 * @property {number|null} id                       - alias renderer legacy (= final_phase)
 * @property {string|null} label                    - alias renderer legacy
 * @property {string|null} goal                     - alias renderer legacy (wording prudent)
 * @property {string[]} allowed_interventions       - alias renderer legacy (= allowed_axes textuels)
 * @property {string[]} blocked_interventions       - alias renderer legacy (= avoid_axes textuels)
 */

/**
 * Détecte la phase microbiome probable depuis le journey_state.
 *
 * @param {object} args
 * @param {object} [args.journeyState]
 * @returns {MicrobiomeStageOutput}
 */
export function detectMicrobiomeStage({ journeyState } = {}) {
  const journey = journeyState || {};
  const rd = journey.results_data || {};
  const fromPlan = Array.isArray(rd.from_plan) ? rd.from_plan : [];

  // 1. Index marker → status[]
  const index = getMarkerStatusIndex(fromPlan);
  const signals = { index };

  // 2. Évaluer les règles
  const votesByPhase = new Map(); // phase → total weight
  const reasonsByPhase = new Map(); // phase → reasons[]
  for (const rule of MICROBIOME_RULES) {
    let fired = false;
    try {
      fired = rule.when(signals) === true;
    } catch {
      fired = false; // règle défectueuse = ignorée silencieusement
    }
    if (!fired) continue;
    votesByPhase.set(rule.phase, (votesByPhase.get(rule.phase) || 0) + rule.weight);
    const reasonsList = reasonsByPhase.get(rule.phase) || [];
    reasonsList.push(rule.reason);
    reasonsByPhase.set(rule.phase, reasonsList);
  }

  // 3. Trouver la phase gagnante avec seuils conservateurs
  let inferredPhase = null;
  let confidence = null;
  let allReasons = [];

  if (votesByPhase.size > 0) {
    const ranked = Array.from(votesByPhase.entries())
      .sort((a, b) => b[1] - a[1]); // [phase, votes] desc
    const [topPhase, topVotes] = ranked[0];
    const runnerUpVotes = ranked[1]?.[1] || 0;

    if (topVotes >= MIN_VOTES_THRESHOLD && (topVotes - runnerUpVotes) > DISCORDANCE_MARGIN) {
      // Vote clair, on infère
      inferredPhase = topPhase;
      allReasons = reasonsByPhase.get(topPhase) || [];

      // Confidence : forte ≥4, modérée ≥3, faible sinon (mais ≥ threshold)
      if (topVotes >= 4) confidence = 'forte';
      else if (topVotes >= 3) confidence = 'modérée';
      else confidence = 'faible';
    } else if (topVotes >= MIN_VOTES_THRESHOLD) {
      // Discordance : 2 phases trop proches → on ne tranche pas mais on
      // garde les reasons des 2 leaders dans l'audit.
      const leaderTie = ranked.filter(([, v]) => topVotes - v <= DISCORDANCE_MARGIN);
      allReasons = leaderTie.flatMap(([p]) => reasonsByPhase.get(p) || []);
      // inferredPhase reste null, confidence reste null
    } else {
      // Pas assez de votes : on listait quand même les raisons pour audit
      allReasons = ranked.flatMap(([p]) => reasonsByPhase.get(p) || []);
    }
  }

  // 4. Override Anissa
  const override = journey.microbiome_override;
  const overridden =
    !!override &&
    typeof override === 'object' &&
    typeof override.phase === 'number' &&
    override.phase >= 1 && override.phase <= 5;

  const finalPhase = overridden ? override.phase : inferredPhase;
  const overrideReason = overridden && typeof override.reason === 'string' ? override.reason : null;

  // 5. Construire la sortie + alias renderer
  const phaseDef = finalPhase ? getPhase(finalPhase) : null;

  return {
    // Champs V3.F
    inferred_phase: inferredPhase,
    final_phase: finalPhase,
    confidence,
    overridden_by_practitioner: overridden,
    override_reason: overrideReason,
    reasons: allReasons,
    target_markers: phaseDef ? [...phaseDef.target_markers] : [],
    allowed_axes: phaseDef ? [...phaseDef.allowed_axes] : [],
    avoid_axes: phaseDef ? [...phaseDef.avoid_axes] : [],

    // Alias renderer legacy (_clinicalContext.fr.js) — wording prudent
    id: finalPhase,
    label: phaseDef ? phaseDef.label : null,
    goal: phaseDef ? buildPrudentGoal(phaseDef, confidence, overridden) : null,
    allowed_interventions: phaseDef ? [...phaseDef.allowed_axes] : [],
    blocked_interventions: phaseDef ? [...phaseDef.avoid_axes] : [],
  };
}

/**
 * Construit l'objectif rendu dans le prompt avec une formulation
 * SUGGESTIVE plutôt que prescriptive.
 *
 * Exemples :
 *   "Orientation compatible : réduire la surcharge pathogène (confiance modérée)."
 *   "Phase retenue par la praticienne : stabilisation microbiome."
 */
function buildPrudentGoal(phaseDef, confidence, overridden) {
  if (overridden) {
    return `Phase retenue par la praticienne : ${phaseDef.description}`;
  }
  const cf = confidence ? ` (confiance ${confidence})` : '';
  return `Orientation compatible : ${phaseDef.description}${cf}`;
}
