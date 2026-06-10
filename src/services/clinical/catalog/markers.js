// V97.4 Phase V3.A — Catalogue des marqueurs cliniques.
// Date : 2026-05-12
//
// Source unique pour :
//   - le label affiché côté UI Anissa
//   - l'unité standard (cohérence inter-tests)
//   - l'axe clinique (inflammation, hormonal, microbiote, carence, métabolique)
//   - les plages de référence (à valider avec Anissa avant usage clinique réel)
//
// Cohérence importante :
//   Les axes cliniques DOIVENT correspondre aux clés CATEGORIES utilisées dans
//   ClientJourneyPage.jsx (BC.5D.2) :
//     hormonal | microbiote | inflammation | carence | metabolique | autre
//
// ⚠️ V3.A : squelette de base avec ~30 marqueurs courants Ortho-Analytic.
// Plages de référence à VALIDER cliniquement avec Anissa avant usage.
// Format souple : ajouts/corrections sans casser la consommation.

/**
 * @typedef {'hormonal' | 'microbiote' | 'inflammation' | 'carence' | 'metabolique' | 'autre'} ClinicalAxis
 */

/**
 * @typedef {Object} Marker
 * @property {string} code              - id stable (snake_case)
 * @property {string} label             - libellé affiché ("Cortisol matin")
 * @property {string} [unit]            - unité standard ("ng/ml", "µg/L", "%", "ratio")
 * @property {ClinicalAxis} axis        - axe clinique principal
 * @property {ClinicalAxis[]} [secondary_axes] - axes secondaires si pertinent
 * @property {object} [ref_range]       - plages indicatives (à valider Anissa)
 * @property {string} [ref_range.low]   - seuil bas
 * @property {string} [ref_range.high]  - seuil haut
 * @property {string} [notes]           - note clinique courte (contexte)
 */

/**
 * Catalogue des marqueurs. Clé = code stable.
 * @type {Record<string, Marker>}
 */
export const MARKERS_CATALOG = {
  // ─── INFLAMMATION ─────────────────────────────────────────────
  crp_us: {
    code: 'crp_us',
    label: 'CRP ultrasensible',
    unit: 'mg/L',
    axis: 'inflammation',
    ref_range: { low: '0', high: '3' },
    notes: 'Marqueur d\'inflammation systémique (us = ultrasensible).',
  },
  ferritine: {
    code: 'ferritine',
    label: 'Ferritine',
    unit: 'µg/L',
    axis: 'carence',
    secondary_axes: ['inflammation'],
    ref_range: { low: '15', high: '150' },
    notes: 'Réserve de fer ET marqueur inflammatoire (élevé = inflammation possible).',
  },
  fibrinogene: {
    code: 'fibrinogene',
    label: 'Fibrinogène',
    unit: 'g/L',
    axis: 'inflammation',
    ref_range: { low: '2', high: '4' },
  },
  homocysteine: {
    code: 'homocysteine',
    label: 'Homocystéine',
    unit: 'µmol/L',
    axis: 'inflammation',
    secondary_axes: ['carence'],
    ref_range: { low: '5', high: '12' },
    notes: 'Marqueur cardiovasculaire, lié aux folates/B12.',
  },
  vitesse_sedimentation: {
    code: 'vitesse_sedimentation',
    label: 'Vitesse de sédimentation',
    unit: 'mm/h',
    axis: 'inflammation',
  },

  // ─── HORMONAL ─────────────────────────────────────────────────
  cortisol_matin: {
    code: 'cortisol_matin',
    label: 'Cortisol matin',
    unit: 'nmol/L',
    axis: 'hormonal',
    ref_range: { low: '140', high: '690' },
    notes: 'Mesuré entre 7h et 9h. Profil journée plus précis (4 prélèvements).',
  },
  cortisol_profil_journee: {
    code: 'cortisol_profil_journee',
    label: 'Cortisol profil journée',
    unit: 'nmol/L',
    axis: 'hormonal',
    notes: 'Profil 4 prélèvements (08h, 11h, 16h, 22h). Évalue le rythme HHS.',
  },
  dhea_s: {
    code: 'dhea_s',
    label: 'DHEA-S',
    unit: 'µmol/L',
    axis: 'hormonal',
    notes: 'Précurseur surrénalien des stéroïdes sexuels. Décline avec âge.',
  },
  tsh: {
    code: 'tsh',
    label: 'TSH',
    unit: 'mU/L',
    axis: 'hormonal',
    ref_range: { low: '0.4', high: '4.0' },
    notes: 'Marqueur thyroïdien de première ligne.',
  },
  t3_libre: {
    code: 't3_libre',
    label: 'T3 libre (fT3)',
    unit: 'pmol/L',
    axis: 'hormonal',
    ref_range: { low: '3.5', high: '6.5' },
  },
  t4_libre: {
    code: 't4_libre',
    label: 'T4 libre (fT4)',
    unit: 'pmol/L',
    axis: 'hormonal',
    ref_range: { low: '10', high: '22' },
  },
  anti_tpo: {
    code: 'anti_tpo',
    label: 'Anti-TPO',
    unit: 'UI/mL',
    axis: 'hormonal',
    secondary_axes: ['inflammation'],
    notes: 'Anticorps thyroperoxydase. Élevés = thyroïdite auto-immune (Hashimoto).',
  },
  estradiol: {
    code: 'estradiol',
    label: 'Œstradiol',
    unit: 'pmol/L',
    axis: 'hormonal',
    notes: 'Interprétation dépend de la phase du cycle.',
  },
  progesterone: {
    code: 'progesterone',
    label: 'Progestérone',
    unit: 'nmol/L',
    axis: 'hormonal',
    notes: 'Mesure pertinente en phase lutéale (J21).',
  },
  testosterone: {
    code: 'testosterone',
    label: 'Testostérone',
    unit: 'nmol/L',
    axis: 'hormonal',
  },
  insuline: {
    code: 'insuline',
    label: 'Insuline à jeun',
    unit: 'mU/L',
    axis: 'hormonal',
    secondary_axes: ['metabolique'],
    ref_range: { low: '2', high: '15' },
  },

  // ─── CARENCE / NUTRITION ──────────────────────────────────────
  vit_d_25oh: {
    code: 'vit_d_25oh',
    label: 'Vitamine D 25(OH)',
    unit: 'nmol/L',
    axis: 'carence',
    ref_range: { low: '75', high: '125' },
    notes: 'Statut vitaminique D. Cible fonctionnelle : 100-150 nmol/L.',
  },
  vit_b12: {
    code: 'vit_b12',
    label: 'Vitamine B12 (cobalamine)',
    unit: 'pmol/L',
    axis: 'carence',
    ref_range: { low: '200', high: '900' },
  },
  folates: {
    code: 'folates',
    label: 'Folates sériques',
    unit: 'nmol/L',
    axis: 'carence',
  },
  fer_serique: {
    code: 'fer_serique',
    label: 'Fer sérique',
    unit: 'µmol/L',
    axis: 'carence',
  },
  transferrine_saturation: {
    code: 'transferrine_saturation',
    label: 'Saturation transferrine',
    unit: '%',
    axis: 'carence',
    ref_range: { low: '20', high: '45' },
  },
  magnesium_globulaire: {
    code: 'magnesium_globulaire',
    label: 'Magnésium globulaire',
    unit: 'mmol/L',
    axis: 'carence',
    notes: 'Plus fiable que le magnésium sérique (reflète stocks intracellulaires).',
  },
  zinc: {
    code: 'zinc',
    label: 'Zinc plasmatique',
    unit: 'µmol/L',
    axis: 'carence',
  },
  selenium: {
    code: 'selenium',
    label: 'Sélénium',
    unit: 'µmol/L',
    axis: 'carence',
  },
  omega_3_index: {
    code: 'omega_3_index',
    label: 'Index oméga-3',
    unit: '%',
    axis: 'carence',
    secondary_axes: ['inflammation'],
    ref_range: { low: '8', high: '12' },
  },

  // ─── MÉTABOLIQUE ──────────────────────────────────────────────
  glycemie_jeun: {
    code: 'glycemie_jeun',
    label: 'Glycémie à jeun',
    unit: 'mmol/L',
    axis: 'metabolique',
    ref_range: { low: '3.9', high: '5.5' },
  },
  hba1c: {
    code: 'hba1c',
    label: 'HbA1c (hémoglobine glyquée)',
    unit: '%',
    axis: 'metabolique',
    ref_range: { low: '4', high: '5.6' },
    notes: 'Reflet glycémique des 3 derniers mois.',
  },
  cholesterol_total: {
    code: 'cholesterol_total',
    label: 'Cholestérol total',
    unit: 'mmol/L',
    axis: 'metabolique',
  },
  ldl_cholesterol: {
    code: 'ldl_cholesterol',
    label: 'LDL cholestérol',
    unit: 'mmol/L',
    axis: 'metabolique',
  },
  hdl_cholesterol: {
    code: 'hdl_cholesterol',
    label: 'HDL cholestérol',
    unit: 'mmol/L',
    axis: 'metabolique',
  },
  triglycerides: {
    code: 'triglycerides',
    label: 'Triglycérides',
    unit: 'mmol/L',
    axis: 'metabolique',
  },
  // Ratio dérivé (utile pour signaux composés futurs V3+)
  tg_hdl_ratio: {
    code: 'tg_hdl_ratio',
    label: 'Ratio TG/HDL',
    unit: 'ratio',
    axis: 'metabolique',
    notes: 'Indicateur fonctionnel d\'insulinorésistance. Cible < 1.5.',
  },

  // ─── MICROBIOTE ───────────────────────────────────────────────
  // ⚠️ V3.A : codes prévus pour le Microbiome NGS Ortho-Analytic.
  // À valider avec Marie-Aude RDV2 — units et plages à confirmer.
  diversite_microbiote: {
    code: 'diversite_microbiote',
    label: 'Diversité microbiotique (Shannon)',
    unit: 'index',
    axis: 'microbiote',
    notes: 'Index Shannon. Diversité faible = dysbiose probable.',
  },
  zonuline: {
    code: 'zonuline',
    label: 'Zonuline',
    unit: 'ng/mL',
    axis: 'microbiote',
    secondary_axes: ['inflammation'],
    notes: 'Marqueur de perméabilité intestinale ("leaky gut" fonctionnel).',
  },
  iga_secretoire: {
    code: 'iga_secretoire',
    label: 'IgA sécrétoire',
    unit: 'mg/g',
    axis: 'microbiote',
    secondary_axes: ['inflammation'],
    notes: 'Immunité muqueuse digestive.',
  },
  calprotectine: {
    code: 'calprotectine',
    label: 'Calprotectine fécale',
    unit: 'µg/g',
    axis: 'microbiote',
    secondary_axes: ['inflammation'],
    ref_range: { low: '0', high: '50' },
    notes: 'Marqueur d\'inflammation intestinale (MICI, SII inflammatoire).',
  },
  akkermansia: {
    code: 'akkermansia',
    label: 'Akkermansia muciniphila',
    unit: '%',
    axis: 'microbiote',
    notes: 'Bactérie clé de la muqueuse intestinale. Faible = perméabilité élevée.',
  },
  faecalibacterium: {
    code: 'faecalibacterium',
    label: 'Faecalibacterium prausnitzii',
    unit: '%',
    axis: 'microbiote',
    secondary_axes: ['inflammation'],
    notes: 'Producteur de butyrate. Faible = inflammation digestive possible.',
  },
  candida_albicans: {
    code: 'candida_albicans',
    label: 'Candida albicans',
    unit: 'présence',
    axis: 'microbiote',
  },

  // ─── V3.G : ajouts post-validation cas réels (2026-05-12) ──────
  // Markers cliniquement utiles repérés pendant la validation V3.G
  // mais absents du squelette V3.A. Permettent aux règles microbiome
  // de fire sur des patterns qu'elles manquaient avant (diversité +
  // butyrate / histamine intestinale / pathogènes parasitaires).
  producteurs_butyrate: {
    code: 'producteurs_butyrate',
    label: 'Producteurs de butyrate',
    unit: 'abondance',
    axis: 'microbiote',
    notes: 'Bactéries productrices de butyrate (Faecalibacterium, Roseburia, Eubacterium rectale). Marqueur fonctionnel clé de la phase 2 recolonisation et 5 stabilisation.',
  },
  histamine_stool: {
    code: 'histamine_stool',
    label: 'Histamine intestinale (selles)',
    unit: 'µg/g',
    axis: 'microbiote',
    secondary_axes: ['inflammation'],
    notes: 'Histamine fécale reflétant la charge histaminergique intestinale. Élevée évoque dysbiose histaminergique / SIBO histaminergique.',
  },
  parasites_qpcr: {
    code: 'parasites_qpcr',
    label: 'Parasites (qPCR)',
    unit: 'détection',
    axis: 'microbiote',
    notes: 'PCR quantitative pour parasites intestinaux (Blastocystis, Dientamoeba, Giardia, etc.). Pertinent en phase 1 éradication aux côtés de Candida.',
  },

  // ⚠️ TODO V3.A à compléter après RDV2 Anissa/Marie-Aude :
  // - métaux lourds (HMA capillaire)
  // - ADN (génétique nutrition) — polymorphismes MTHFR, COMT, APOE, FTO, etc.
  // - acides organiques urinaires
  // - néopterine
};

// ─── P1.4 — Plafonds de plausibilité de saisie ────────────────────────────
// (remède sécurité clinique, 2026-06-10)
//
// ⚠️ DÉFAUTS CONSERVATEURS À VALIDER PAR ANISSA. Ce sont des plafonds, pas des
// plages de référence : ils servent à repérer une FAUTE DE FRAPPE (zéro en
// trop, mauvaise unité), PAS une valeur anormale. Volontairement TRÈS larges
// — bien au-delà du pathologique extrême — pour ne se déclencher que sur
// l'invraisemblable. La validation est NON BLOQUANTE : un simple avertissement
// de saisie. Anissa peut confirmer une vraie valeur extrême.
//
// Un marqueur absent de cette table n'est pas évalué (aucun avertissement) :
// on préfère ne rien dire plutôt que de gêner Anissa avec un seuil deviné.
export const MARKER_PLAUSIBLE_MAX = {
  crp_us: 1000,
  ferritine: 5000,
  fibrinogene: 50,
  homocysteine: 500,
  cortisol_matin: 5000,
  tsh: 300,
  t3_libre: 100,
  t4_libre: 200,
  insuline: 2000,
  vit_d_25oh: 1000,
  vit_b12: 20000,
  transferrine_saturation: 150,
  omega_3_index: 100,
  glycemie_jeun: 100,
  hba1c: 25,
  calprotectine: 100000,
};

/** Extrait le premier nombre d'une saisie libre (gère la décimale française). */
function parseNumericValue(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * P1.4 — Valide la PLAUSIBILITÉ d'une valeur labo saisie. Pure, fail-soft.
 * Retourne `assessed:false` quand on ne peut pas se prononcer (non numérique,
 * pas de plafond défini, code inconnu) — jamais un avertissement par défaut.
 *
 * @param {string} code - code marqueur du catalogue.
 * @param {string|number} rawValue - valeur saisie (texte libre toléré).
 * @returns {{ plausible: boolean, assessed: boolean, message?: string }}
 */
export function validateMarkerValue(code, rawValue) {
  const n = parseNumericValue(rawValue);
  if (n === null) return { plausible: true, assessed: false };

  if (n < 0) {
    return { plausible: false, assessed: true, message: 'Valeur négative — vérifie la saisie.' };
  }

  const max = MARKER_PLAUSIBLE_MAX[code];
  if (typeof max !== 'number') return { plausible: true, assessed: false };

  if (n > max) {
    const unit = MARKERS_CATALOG[code]?.unit ? ` ${MARKERS_CATALOG[code].unit}` : '';
    return {
      plausible: false,
      assessed: true,
      message: `Valeur inhabituellement élevée (${n}${unit}) — vérifie la saisie (unité, zéro en trop ?).`,
    };
  }
  return { plausible: true, assessed: true };
}

/**
 * Récupère un marqueur par code. Tolère les codes inconnus (retourne null).
 */
export function getMarker(code) {
  if (!code || typeof code !== 'string') return null;
  return MARKERS_CATALOG[code] || null;
}

/**
 * Liste tous les marqueurs d'un axe donné.
 */
export function getMarkersByAxis(axis) {
  if (!axis) return [];
  return Object.values(MARKERS_CATALOG).filter((m) => m.axis === axis);
}

/**
 * Liste toutes les axes cliniques disponibles dans le catalogue.
 */
export function getAvailableAxes() {
  const axes = new Set();
  for (const m of Object.values(MARKERS_CATALOG)) {
    axes.add(m.axis);
  }
  return Array.from(axes);
}
