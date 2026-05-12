// V97.4 V3.F — Catalogue des 5 phases microbiome (modèle Ortho-Analytic).
// Date : 2026-05-12
//
// Référence : logique microbiome alignée sur les rapports Ortho-Analytic
// qu'Anissa reçoit et restitue. Permet au SaaS de parler le même langage
// clinique que le labo partenaire.
//
// ⚠️ Ces phases sont SUGGESTIVES, jamais prescriptives.
// Le moteur de détection (detectMicrobiomeStage.js) propose une phase
// probable. Anissa garde la décision finale via le mécanisme d'override.
//
// Cohérence :
//   - axes cliniques (allowed_axes / avoid_axes) utilisent le vocabulaire
//     de markers.js : hormonal / microbiote / inflammation / carence /
//     metabolique / autre.
//   - target_markers réfèrent à des codes markers.js valides.

/**
 * @typedef {Object} MicrobiomePhase
 * @property {number} id                       - 1 à 5
 * @property {string} code                     - id stable (snake_case)
 * @property {string} label                    - libellé affiché
 * @property {string} description              - 1 phrase clinique
 * @property {string[]} target_markers         - codes markers (markers.js) typiques de la phase
 * @property {string[]} allowed_axes           - axes cliniques compatibles
 * @property {string[]} avoid_axes             - axes à éviter (peuvent compliquer la phase)
 */

/**
 * @type {Record<number, MicrobiomePhase>}
 */
export const MICROBIOME_PHASES = {
  1: {
    id: 1,
    code: 'eradication',
    label: 'Éradication',
    description: 'Réduire la surcharge pathogène (candida, dysbiose marquée, intolérances aiguës).',
    target_markers: ['candida_albicans', 'calprotectine'],
    allowed_axes: ['microbiote'],
    avoid_axes: ['carence'], // pas le bon moment pour pousser des suppléments lourds
  },
  2: {
    id: 2,
    code: 'recolonisation',
    label: 'Recolonisation',
    description: 'Stabiliser le terrain microbien après éradication ou en cas de diversité faible.',
    target_markers: ['akkermansia', 'faecalibacterium', 'diversite_microbiote'],
    allowed_axes: ['microbiote'],
    avoid_axes: ['inflammation'], // attendre apaisement avant de pousser les probiotiques
  },
  3: {
    id: 3,
    code: 'muqueuse_immunoregulation',
    label: 'Muqueuse / immunorégulation',
    description: 'Réparer la barrière intestinale et moduler l\'inflammation locale.',
    target_markers: ['zonuline', 'iga_secretoire', 'calprotectine'],
    allowed_axes: ['microbiote', 'inflammation'],
    avoid_axes: [],
  },
  4: {
    id: 4,
    code: 'regulation_immunitaire',
    label: 'Régulation immunitaire',
    description: 'Consolidation : tolérance immunitaire, équilibre Th1/Th2/Th17.',
    target_markers: ['iga_secretoire', 'crp_us'],
    allowed_axes: ['inflammation', 'microbiote'],
    avoid_axes: [],
  },
  5: {
    id: 5,
    code: 'stabilisation',
    label: 'Stabilisation microbiome',
    description: 'Diversité acquise + maintenance long terme. Approche alimentaire dominante.',
    target_markers: ['diversite_microbiote', 'akkermansia', 'faecalibacterium'],
    allowed_axes: ['microbiote', 'carence', 'metabolique'],
    avoid_axes: [],
  },
};

/**
 * Récupère une phase par id. Retourne null si inconnue.
 * @param {number} id
 * @returns {MicrobiomePhase | null}
 */
export function getPhase(id) {
  if (typeof id !== 'number') return null;
  return MICROBIOME_PHASES[id] || null;
}

/**
 * Liste des ids valides (1 à 5).
 * @returns {number[]}
 */
export function getAllPhaseIds() {
  return Object.keys(MICROBIOME_PHASES).map(Number).sort();
}
