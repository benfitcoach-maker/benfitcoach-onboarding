// V97.4 V3.F — Règles déclaratives de détection de phase microbiome.
// Date : 2026-05-12
//
// Philosophie : RULE-BASED, CONSERVATEUR, PLURI-FACTORIEL.
//
// Aucune règle ne dit "marker X → phase Y". Chaque règle décrit un
// PATTERN clinique qui vote pour une phase avec un poids 1-2.
// Le moteur (detectMicrobiomeStage.js) agrège les votes et n'infère
// une phase QUE si plusieurs règles convergent.
//
// Anti-pattern interdit : "zonuline élevée → phase 3 automatique".
// Bon pattern : "zonuline ET (calprotectine OU IgA basse) → vote phase 3".
//
// Format d'une règle :
//   {
//     id: 'snake_case_id',
//     phase: 1-5,           ← phase pour laquelle la règle vote
//     weight: 1 | 2,         ← poids du vote
//     when: (signals) => bool,  ← prédicat sur les signaux normalisés
//     reason: string,        ← phrase humaine pour audit (reasons[])
//   }
//
// Wording des reasons : factuel, sans verdict.
//   ✅ "Candida albicans flaggué prioritaire par Anissa"
//   ❌ "La cliente est en phase 1"

import {
  hasMarkerWithStatus,
  anyMarkerWithStatus,
  countMarkersWithStatus,
} from './microbiomeSignals';

/**
 * @typedef {Object} MicrobiomeRule
 * @property {string} id
 * @property {number} phase
 * @property {1|2} weight
 * @property {(signals: { index: Map<string, string[]> }) => boolean} when
 * @property {string} reason
 */

/**
 * @type {MicrobiomeRule[]}
 */
export const MICROBIOME_RULES = [
  // ═══════════════════════════════════════════════════════════════
  // PHASE 1 — ÉRADICATION (réduire surcharge pathogène)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'candida_prioritaire',
    phase: 1,
    weight: 2,
    when: ({ index }) => hasMarkerWithStatus(index, 'candida_albicans', 'prioritaire'),
    reason: 'Candida albicans flaggué prioritaire par Anissa',
  },
  {
    id: 'candida_surveiller_avec_calprotectine',
    phase: 1,
    weight: 1,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'candida_albicans', 'surveiller', 'prioritaire') &&
      hasMarkerWithStatus(index, 'calprotectine', 'prioritaire'),
    reason: 'Candida à surveiller + calprotectine prioritaire (inflammation aiguë)',
  },
  // V3.G : ajout post-validation cas 3. Renforce P1 quand le pattern
  // candida+parasites coexiste, sans surclasser un candida isolé.
  // weight intentionnellement bas (1) pour éviter sur-classification.
  {
    id: 'candida_avec_pathogene',
    phase: 1,
    weight: 1,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'candida_albicans', 'prioritaire') &&
      hasMarkerWithStatus(index, 'parasites_qpcr', 'prioritaire', 'surveiller'),
    reason: 'Candida prioritaire + parasites (qPCR) flaggés (pattern pathogène)',
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2 — RECOLONISATION (stabiliser terrain)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'flore_protectrice_basse',
    phase: 2,
    weight: 2,
    when: ({ index }) =>
      countMarkersWithStatus(index, ['akkermansia', 'faecalibacterium'], 'prioritaire', 'surveiller') >= 2,
    reason: 'Flore protectrice (Akkermansia + Faecalibacterium) flaggée (≥2 markers)',
  },
  {
    id: 'diversite_basse_sans_inflammation_aigue',
    phase: 2,
    weight: 1,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'diversite_microbiote', 'prioritaire', 'surveiller') &&
      !hasMarkerWithStatus(index, 'calprotectine', 'prioritaire'),
    reason: 'Diversité microbiote flaggée sans inflammation aiguë → recolonisation envisageable',
  },
  // V3.G : ajout post-validation cas 2. Diversité prioritaire ISOLÉE
  // (= aucun marker barrière/inflammation prioritaire) est un pattern
  // P2 cliniquement net qui n'avait pas assez de votes auparavant.
  // weight 2 → permet de franchir le seuil sans dépendre de combos.
  {
    id: 'diversite_prioritaire_isolee',
    phase: 2,
    weight: 2,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'diversite_microbiote', 'prioritaire') &&
      countMarkersWithStatus(
        index,
        ['zonuline', 'calprotectine', 'candida_albicans', 'iga_secretoire'],
        'prioritaire',
      ) === 0,
    reason: 'Diversité microbiote prioritaire isolée (aucun marker barrière/inflammation prioritaire)',
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3 — MUQUEUSE / IMMUNORÉGULATION (réparer barrière)
  // ═══════════════════════════════════════════════════════════════
  {
    // V3.G : weight 2 → 3 après validation cas 1.
    // Le pattern zonuline + (IgA OU calprotectine) est cliniquement très
    // fort. Le poids 2 le faisait perdre par discordance face à des
    // règles P2 collatérales. Poids 3 → écrase P2 même quand il fire.
    id: 'permeabilite_pattern',
    phase: 3,
    weight: 3,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'zonuline', 'prioritaire', 'surveiller') &&
      anyMarkerWithStatus(index, ['iga_secretoire', 'calprotectine'], 'prioritaire', 'surveiller'),
    reason: 'Zonuline flaggée + IgA sécrétoire ou calprotectine flaggée (pattern perméabilité)',
  },
  {
    id: 'inflammation_locale_pattern',
    phase: 3,
    weight: 1,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'calprotectine', 'prioritaire') &&
      !hasMarkerWithStatus(index, 'candida_albicans', 'prioritaire'),
    reason: 'Calprotectine prioritaire sans candida aigu → inflammation locale, focus muqueuse',
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4 — RÉGULATION IMMUNITAIRE (consolidation)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'inflammation_systemique_persistante',
    phase: 4,
    weight: 2,
    when: ({ index }) =>
      countMarkersWithStatus(index, ['crp_us', 'fibrinogene', 'homocysteine'], 'prioritaire', 'surveiller') >= 2 &&
      !hasMarkerWithStatus(index, 'zonuline', 'prioritaire'),
    reason: 'Inflammation systémique multi-markers sans zonuline aiguë → régulation immunitaire',
  },
  {
    id: 'iga_basse_isolee',
    phase: 4,
    weight: 1,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'iga_secretoire', 'prioritaire', 'surveiller') &&
      !hasMarkerWithStatus(index, 'zonuline', 'prioritaire', 'surveiller') &&
      !hasMarkerWithStatus(index, 'calprotectine', 'prioritaire'),
    reason: 'IgA sécrétoire flaggée isolément → tolérance immunitaire à soutenir',
  },

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5 — STABILISATION (diversité + maintenance)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'diversite_basse_sans_autres_flags',
    phase: 5,
    weight: 1,
    when: ({ index }) =>
      hasMarkerWithStatus(index, 'diversite_microbiote', 'surveiller') &&
      countMarkersWithStatus(
        index,
        ['zonuline', 'calprotectine', 'candida_albicans', 'iga_secretoire'],
        'prioritaire',
      ) === 0,
    reason: 'Diversité à surveiller, aucun marker barrière/inflammation prioritaire → stabilisation',
  },
  {
    id: 'flore_protectrice_optimale',
    phase: 5,
    weight: 1,
    when: ({ index }) =>
      countMarkersWithStatus(index, ['akkermansia', 'faecalibacterium'], 'optimal') >= 1 &&
      countMarkersWithStatus(
        index,
        ['zonuline', 'calprotectine', 'candida_albicans'],
        'prioritaire', 'surveiller',
      ) === 0,
    reason: 'Flore protectrice optimale + aucun signe aigu → maintenance',
  },
];
