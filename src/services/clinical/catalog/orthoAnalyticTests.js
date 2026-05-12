// V97.4 Phase V3.A — Catalogue Ortho-Analytic (tests + mapping markers).
// Date : 2026-05-12
//
// Source de vérité pour :
//   - tests disponibles chez le partenaire Ortho-Analytic
//   - prix Anissa (coût payé par Anissa au labo)
//   - prix cliente (s'il y a marge praticienne)
//   - laboratoire émetteur (Ortho-Analytic, MGD, autres si besoin)
//   - catégorie clinique
//   - marqueurs attendus (mapping vers ./markers.js)
//   - axes cliniques principaux ciblés
//
// ⚠️ V3.A : squelette structuré. Plusieurs prix sont des PLACEHOLDERS à
// confirmer avec Marie-Aude au RDV2 (HMA capillaire, Microbiome NGS, ADN,
// programme partenaire). Les entrées marquées `price_chf: null` ou avec
// commentaire TODO doivent être complétées avant usage commercial.
//
// Cohérence importante :
//   - shape compatible avec _clinicalContext.fr.js (champs name, lab,
//     category, price_chf reconnus par formatTest())
//   - shape compatible avec buildClinicalContext (champ category, mapping
//     vers axes cliniques BC.5D.2 : hormonal / microbiote / inflammation /
//     carence / metabolique / autre)
//
// Source des prix actuels :
//   Ortho-Analytic Preisliste Integrative Medizin V12.04.2026
//   (mémoire 2026-05-07 — décryptage tarif)

import { MARKERS_CATALOG } from './markers';

/**
 * @typedef {Object} OrthoTest
 * @property {string}   code                  - id stable (snake_case)
 * @property {string}   name                  - libellé affiché ("Mikroernährung")
 * @property {string}   lab                   - laboratoire ("Ortho-Analytic" | "MGD")
 * @property {string}   category              - catégorie technique ("sang" | "microbiome" | "genetique" | "metaux_lourds" | "hormones" | "vitamines_mineraux")
 * @property {string}   clinical_category     - catégorie clinique (axe principal — pour mapping BC.5D.2)
 * @property {number|null} price_chf          - prix labo payé par Anissa (null = à compléter)
 * @property {number}   [price_cliente_chf]   - prix facturé cliente (si différent de price_chf)
 * @property {string[]} expected_markers      - codes markers (cf. ./markers.js)
 * @property {string}   [description]         - 1 phrase contexte clinique
 * @property {boolean}  [is_active]           - true par défaut, false = retiré du catalogue
 * @property {string}   [todo]                - note interne si entrée incomplète
 */

/**
 * Catalogue Ortho-Analytic + MGD. Clé = code stable.
 * @type {Record<string, OrthoTest>}
 */
export const ORTHO_TESTS_CATALOG = {

  // ═══════════════════════════════════════════════════════════════
  // PROFILS SANG — Ortho-Analytic
  // ═══════════════════════════════════════════════════════════════

  ortho_mikroernaehrung: {
    code: 'ortho_mikroernaehrung',
    name: 'Mikroernährung (micronutrition)',
    lab: 'Ortho-Analytic',
    category: 'sang',
    clinical_category: 'carence',
    price_chf: 248,
    expected_markers: [
      'vit_d_25oh', 'vit_b12', 'folates',
      'fer_serique', 'ferritine', 'transferrine_saturation',
      'magnesium_globulaire', 'zinc', 'selenium',
      'omega_3_index',
    ],
    description: 'Bilan micronutrition complet : vitamines, minéraux, oligo-éléments, oméga-3.',
    is_active: true,
  },

  ortho_thyroide_complete: {
    code: 'ortho_thyroide_complete',
    name: 'Profil thyroïdien complet',
    lab: 'Ortho-Analytic',
    category: 'sang',
    clinical_category: 'hormonal',
    price_chf: 95,
    expected_markers: ['tsh', 't3_libre', 't4_libre', 'anti_tpo'],
    description: 'Bilan thyroïdien étendu : TSH + T3/T4 libres + anti-TPO.',
    is_active: true,
  },

  ortho_inflammation: {
    code: 'ortho_inflammation',
    name: 'Profil inflammation systémique',
    lab: 'Ortho-Analytic',
    category: 'sang',
    clinical_category: 'inflammation',
    price_chf: null, // TODO RDV2 Marie-Aude
    expected_markers: ['crp_us', 'fibrinogene', 'vitesse_sedimentation', 'homocysteine'],
    description: 'Marqueurs inflammatoires de bas grade.',
    is_active: true,
    todo: 'Confirmer prix exact + composition exacte du profil',
  },

  ortho_hormones_feminines: {
    code: 'ortho_hormones_feminines',
    name: 'Profil hormonal féminin',
    lab: 'Ortho-Analytic',
    category: 'sang',
    clinical_category: 'hormonal',
    price_chf: null, // TODO RDV2
    expected_markers: ['estradiol', 'progesterone', 'dhea_s', 'testosterone'],
    description: 'Hormones sexuelles + précurseurs surrénaliens.',
    is_active: true,
    todo: 'Confirmer prix et timing prélèvement (phase cycle)',
  },

  ortho_cortisol_journee: {
    code: 'ortho_cortisol_journee',
    name: 'Cortisol profil journée (4 prélèvements)',
    lab: 'Ortho-Analytic',
    category: 'sang',
    clinical_category: 'hormonal',
    price_chf: null, // TODO RDV2
    expected_markers: ['cortisol_profil_journee', 'cortisol_matin', 'dhea_s'],
    description: 'Évaluation du rythme HHS sur la journée (08h, 11h, 16h, 22h).',
    is_active: true,
    todo: 'Confirmer prix et logistique prélèvements à domicile',
  },

  ortho_metabolique: {
    code: 'ortho_metabolique',
    name: 'Profil métabolique',
    lab: 'Ortho-Analytic',
    category: 'sang',
    clinical_category: 'metabolique',
    price_chf: null, // TODO RDV2
    expected_markers: [
      'glycemie_jeun', 'hba1c', 'insuline',
      'cholesterol_total', 'ldl_cholesterol', 'hdl_cholesterol',
      'triglycerides',
    ],
    description: 'Bilan lipidique + glycémique + insulinorésistance fonctionnelle.',
    is_active: true,
    todo: 'Confirmer composition exacte et prix',
  },

  // ═══════════════════════════════════════════════════════════════
  // MICROBIOME — Ortho-Analytic
  // ═══════════════════════════════════════════════════════════════

  ortho_microbiome_complete_plus: {
    code: 'ortho_microbiome_complete_plus',
    name: 'Microbiome Complete Plus (NGS)',
    lab: 'Ortho-Analytic',
    category: 'microbiome',
    clinical_category: 'microbiote',
    price_chf: null, // TODO RDV2 Marie-Aude (mémoire indique manquant)
    expected_markers: [
      'diversite_microbiote',
      'akkermansia', 'faecalibacterium',
      'iga_secretoire', 'zonuline',
      'calprotectine', 'candida_albicans',
    ],
    description: 'Analyse NGS du microbiote intestinal : diversité, dysbiose, perméabilité.',
    is_active: true,
    todo: 'Confirmer prix exact + délai labo + format rapport',
  },

  // ═══════════════════════════════════════════════════════════════
  // MÉTAUX LOURDS — HMA capillaire
  // ═══════════════════════════════════════════════════════════════

  ortho_hma_capillaire: {
    code: 'ortho_hma_capillaire',
    name: 'HMA capillaire (métaux lourds)',
    lab: 'Ortho-Analytic',
    category: 'metaux_lourds',
    clinical_category: 'autre',
    price_chf: null, // TODO RDV2 (mémoire indique manquant)
    expected_markers: [
      // Codes à créer dans markers.js V3.B : mercure, plomb, aluminium, cadmium, arsenic
    ],
    description: 'Analyse minérale et toxique sur cheveu (reflet 6-12 dernières semaines).',
    is_active: true,
    todo: 'Confirmer prix + créer codes markers métaux lourds dans markers.js',
  },

  // ═══════════════════════════════════════════════════════════════
  // GÉNÉTIQUE — ADN nutrition / épigénétique
  // ═══════════════════════════════════════════════════════════════

  ortho_genetique_nutrition: {
    code: 'ortho_genetique_nutrition',
    name: 'Profil ADN nutrition fonctionnelle',
    lab: 'Ortho-Analytic',
    category: 'genetique',
    clinical_category: 'autre',
    price_chf: null, // TODO RDV2 (mémoire indique manquant)
    expected_markers: [
      // Codes à créer dans markers.js V3.B : MTHFR, COMT, APOE, FTO, GSTT1, GSTM1, etc.
    ],
    description: 'Polymorphismes liés à méthylation, détoxification, lipides, glucides.',
    is_active: true,
    todo: 'Confirmer prix + scope exact des SNPs analysés + créer codes markers ADN',
  },

  // ═══════════════════════════════════════════════════════════════
  // MGD (LaboMGD Genève) — héritage Anissa avant switch Ortho
  // ═══════════════════════════════════════════════════════════════
  // Note : conservés en référence pour les clientes en cours de pack
  // MGD. Sur les nouveaux packs, Anissa migre vers Ortho.

  mgd_bilan_nutritionnel_base: {
    code: 'mgd_bilan_nutritionnel_base',
    name: 'Bilan nutritionnel de base (MGD)',
    lab: 'MGD',
    category: 'sang',
    clinical_category: 'carence',
    price_chf: 233.6,
    expected_markers: ['vit_d_25oh', 'vit_b12', 'folates', 'ferritine', 'magnesium_globulaire'],
    description: 'Bilan micronutrition LaboMGD. Équivalent partiel du Mikroernährung Ortho.',
    is_active: false, // Conservé pour historique, plus prescrit en V97.4+
  },

  mgd_microbiote_adn: {
    code: 'mgd_microbiote_adn',
    name: 'Microbiote ADN (MGD)',
    lab: 'MGD',
    category: 'microbiome',
    clinical_category: 'microbiote',
    price_chf: 173.6,
    expected_markers: ['diversite_microbiote', 'akkermansia', 'faecalibacterium'],
    description: 'Analyse microbiote MGD. Migration vers Ortho Microbiome Complete Plus.',
    is_active: false,
  },

  mgd_elipsegenes: {
    code: 'mgd_elipsegenes',
    name: 'ELIPSEgenes (MGD)',
    lab: 'MGD',
    category: 'genetique',
    clinical_category: 'autre',
    price_chf: 358,
    expected_markers: [],
    description: 'Profil génétique MGD. Migration vers Ortho ADN nutrition.',
    is_active: false,
  },
};

/**
 * Récupère un test par code. Retourne null si inconnu.
 */
export function getTest(code) {
  if (!code || typeof code !== 'string') return null;
  return ORTHO_TESTS_CATALOG[code] || null;
}

/**
 * Liste les tests actifs (filtre is_active === false).
 * Par défaut : seuls les tests utilisables actuellement.
 */
export function getActiveTests({ includeInactive = false } = {}) {
  const all = Object.values(ORTHO_TESTS_CATALOG);
  if (includeInactive) return all;
  return all.filter((t) => t.is_active !== false);
}

/**
 * Liste les tests pour un laboratoire donné ('Ortho-Analytic' | 'MGD').
 */
export function getTestsByLab(lab) {
  if (!lab) return [];
  return Object.values(ORTHO_TESTS_CATALOG).filter((t) => t.lab === lab && t.is_active !== false);
}

/**
 * Pour un code de test, retourne les marqueurs attendus enrichis depuis
 * le catalogue markers.js. Filtre les codes inconnus silencieusement.
 *
 * @param {string} testCode
 * @returns {Array<import('./markers').Marker>}
 */
export function getExpectedMarkersForTest(testCode) {
  const test = getTest(testCode);
  if (!test || !Array.isArray(test.expected_markers)) return [];
  return test.expected_markers
    .map((markerCode) => MARKERS_CATALOG[markerCode])
    .filter(Boolean);
}

/**
 * Liste tous les codes de tests qui n'ont pas encore de prix renseigné.
 * Utile pour QA / dashboard admin.
 */
export function getTestsWithMissingPrices() {
  return Object.values(ORTHO_TESTS_CATALOG)
    .filter((t) => t.is_active !== false && (t.price_chf === null || t.price_chf === undefined));
}

/**
 * Liste les TODO documentés (prix manquants + scope incomplet).
 */
export function getCatalogTodos() {
  return Object.values(ORTHO_TESTS_CATALOG)
    .filter((t) => t.todo)
    .map((t) => ({ code: t.code, name: t.name, todo: t.todo }));
}
