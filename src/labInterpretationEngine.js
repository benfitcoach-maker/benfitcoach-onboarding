// Lab Interpretation Engine — V1
// Lecture fonctionnelle de resultats biologiques structures
// Pas de diagnostic medical — signaux nutritionnels uniquement

// ─── REFERENCE RANGES (adulte, fonctionnel) ───

const LAB_MARKERS = {
  ferritine: {
    unit: 'ng/mL',
    ranges: { low: [0, 30], low_borderline: [30, 50], normal: [50, 200], high_borderline: [200, 300], high: [300, Infinity] },
    signal_low: 'low_iron_status',
    signal_high: 'iron_overload',
    label: 'Ferritine',
  },
  fer_serique: {
    unit: 'µmol/L',
    ranges: { low: [0, 10], low_borderline: [10, 14], normal: [14, 32], high_borderline: [32, 40], high: [40, Infinity] },
    signal_low: 'low_iron_status',
    signal_high: null,
    label: 'Fer serique',
  },
  vitamine_d: {
    unit: 'ng/mL',
    ranges: { low: [0, 20], low_borderline: [20, 30], normal: [30, 60], high_borderline: [60, 80], high: [80, Infinity] },
    signal_low: 'low_vitamin_d',
    signal_high: 'excess_vitamin_d',
    label: 'Vitamine D',
  },
  vitamine_b12: {
    unit: 'pg/mL',
    ranges: { low: [0, 300], low_borderline: [300, 450], normal: [450, 900], high_borderline: [900, 1200], high: [1200, Infinity] },
    signal_low: 'low_b12',
    signal_high: null,
    label: 'Vitamine B12',
  },
  folates: {
    unit: 'ng/mL',
    ranges: { low: [0, 5], low_borderline: [5, 8], normal: [8, 20], high_borderline: [20, 30], high: [30, Infinity] },
    signal_low: 'low_folates',
    signal_high: null,
    label: 'Folates (B9)',
  },
  glucose_jeun: {
    unit: 'mg/dL',
    ranges: { low: [0, 70], low_borderline: [70, 80], normal: [80, 100], high_borderline: [100, 126], high: [126, Infinity] },
    signal_low: 'hypoglycemia_tendency',
    signal_high: 'glycemic_dysregulation',
    label: 'Glucose a jeun',
  },
  insuline_jeun: {
    unit: 'µU/mL',
    ranges: { low: [0, 2], low_borderline: [2, 3], normal: [3, 10], high_borderline: [10, 15], high: [15, Infinity] },
    signal_low: null,
    signal_high: 'insulin_resistance',
    label: 'Insuline a jeun',
  },
  hba1c: {
    unit: '%',
    ranges: { low: [0, 4.5], low_borderline: [4.5, 4.8], normal: [4.8, 5.6], high_borderline: [5.6, 6.4], high: [6.4, Infinity] },
    signal_low: null,
    signal_high: 'glycemic_dysregulation',
    label: 'HbA1c',
  },
  tsh: {
    unit: 'mUI/L',
    ranges: { low: [0, 0.4], low_borderline: [0.4, 1.0], normal: [1.0, 3.5], high_borderline: [3.5, 5.0], high: [5.0, Infinity] },
    signal_low: 'tsh_low_to_investigate',
    signal_low_borderline: null,  // 0.4-1.0 = normal, pas de signal
    signal_high: 'tsh_high_to_investigate',
    signal_high_borderline: 'thyroid_axis_to_monitor',
    label: 'TSH',
  },
  t3_libre: {
    unit: 'pg/mL',
    ranges: { low: [0, 2.3], low_borderline: [2.3, 2.8], normal: [2.8, 4.2], high_borderline: [4.2, 5.0], high: [5.0, Infinity] },
    signal_low: 'thyroid_conversion_to_monitor',
    signal_high: null,
    label: 'T3 libre',
  },
  t4_libre: {
    unit: 'ng/dL',
    ranges: { low: [0, 0.8], low_borderline: [0.8, 1.0], normal: [1.0, 1.7], high_borderline: [1.7, 2.0], high: [2.0, Infinity] },
    signal_low: 'thyroid_axis_to_monitor',
    signal_high: 'tsh_low_to_investigate',
    label: 'T4 libre',
  },
  crp_us: {
    unit: 'mg/L',
    ranges: { low: [0, 0], low_borderline: [0, 0], normal: [0, 1.0], high_borderline: [1.0, 3.0], high: [3.0, Infinity] },
    signal_low: null,
    signal_high: 'low_grade_inflammation',
    label: 'CRP ultrasensible',
  },
  magnesium: {
    unit: 'mg/L',
    ranges: { low: [0, 18], low_borderline: [18, 20], normal: [20, 25], high_borderline: [25, 28], high: [28, Infinity] },
    signal_low: 'low_magnesium',
    signal_high: null,
    label: 'Magnesium',
  },
  zinc: {
    unit: 'µg/dL',
    ranges: { low: [0, 70], low_borderline: [70, 80], normal: [80, 120], high_borderline: [120, 140], high: [140, Infinity] },
    signal_low: 'low_zinc',
    signal_high: null,
    label: 'Zinc',
  },
  // ─── V45 : MARQUEURS ETENDUS ───
  // Lipides
  cholesterol_total: {
    unit: 'mg/dL',
    ranges: { low: [0, 150], low_borderline: [150, 170], normal: [170, 200], high_borderline: [200, 240], high: [240, Infinity] },
    signal_low: null,
    signal_high: 'high_cholesterol',
    label: 'Cholesterol total',
  },
  hdl: {
    unit: 'mg/dL',
    ranges: { low: [0, 40], low_borderline: [40, 50], normal: [50, 80], high_borderline: [80, 100], high: [100, Infinity] },
    signal_low: 'low_hdl',
    signal_high: null,
    label: 'HDL',
  },
  ldl: {
    unit: 'mg/dL',
    ranges: { low: [0, 70], low_borderline: [70, 100], normal: [100, 130], high_borderline: [130, 160], high: [160, Infinity] },
    signal_low: null,
    signal_high: 'high_ldl',
    label: 'LDL',
  },
  triglycerides: {
    unit: 'mg/dL',
    ranges: { low: [0, 50], low_borderline: [50, 70], normal: [70, 150], high_borderline: [150, 200], high: [200, Infinity] },
    signal_low: null,
    signal_high: 'high_triglycerides',
    label: 'Triglycerides',
  },
  homocysteine: {
    unit: 'µmol/L',
    ranges: { low: [0, 4], low_borderline: [4, 6], normal: [6, 10], high_borderline: [10, 15], high: [15, Infinity] },
    signal_low: null,
    signal_high: 'high_homocysteine',
    label: 'Homocysteine',
  },
  // Hemogramme
  hemoglobine: {
    unit: 'g/dL',
    ranges: { low: [0, 11.5], low_borderline: [11.5, 12.5], normal: [12.5, 16.5], high_borderline: [16.5, 17.5], high: [17.5, Infinity] },
    signal_low: 'low_hemoglobin',
    signal_high: null,
    label: 'Hemoglobine',
  },
  hematocrite: {
    unit: '%',
    ranges: { low: [0, 35], low_borderline: [35, 37], normal: [37, 48], high_borderline: [48, 52], high: [52, Infinity] },
    signal_low: 'low_hematocrite',
    signal_high: null,
    label: 'Hematocrite',
  },
  // Thyroide etendue
  t3_reverse: {
    unit: 'ng/dL',
    ranges: { low: [0, 8], low_borderline: [8, 10], normal: [10, 24], high_borderline: [24, 28], high: [28, Infinity] },
    signal_low: null,
    signal_high: 'high_rt3',
    label: 'T3 reverse',
  },
  anti_tpo: {
    unit: 'UI/mL',
    ranges: { low: [0, 0], low_borderline: [0, 0], normal: [0, 35], high_borderline: [35, 100], high: [100, Infinity] },
    signal_low: null,
    signal_high: 'autoimmune_thyroid',
    label: 'Anti-TPO',
  },
  anti_tg: {
    unit: 'UI/mL',
    ranges: { low: [0, 0], low_borderline: [0, 0], normal: [0, 40], high_borderline: [40, 115], high: [115, Infinity] },
    signal_low: null,
    signal_high: 'autoimmune_thyroid',
    label: 'Anti-Tg',
  },
  iode_urinaire: {
    unit: 'µg/L',
    ranges: { low: [0, 50], low_borderline: [50, 100], normal: [100, 200], high_borderline: [200, 300], high: [300, Infinity] },
    signal_low: 'low_iodine',
    signal_high: null,
    label: 'Iode urinaire',
  },
  // Cofacteurs
  cuivre: {
    unit: 'µg/dL',
    ranges: { low: [0, 70], low_borderline: [70, 80], normal: [80, 140], high_borderline: [140, 160], high: [160, Infinity] },
    signal_low: 'low_copper',
    signal_high: 'high_copper',
    label: 'Cuivre',
  },
  selenium: {
    unit: 'µg/L',
    ranges: { low: [0, 70], low_borderline: [70, 80], normal: [80, 160], high_borderline: [160, 200], high: [200, Infinity] },
    signal_low: 'low_selenium',
    signal_high: null,
    label: 'Selenium',
  },
  magnesium_erythro: {
    unit: 'mmol/L',
    ranges: { low: [0, 1.5], low_borderline: [1.5, 1.65], normal: [1.65, 2.65], high_borderline: [2.65, 2.85], high: [2.85, Infinity] },
    signal_low: 'low_magnesium',
    signal_high: null,
    label: 'Magnesium erythrocytaire',
  },
  // Intestinal
  zonuline: {
    unit: 'ng/mL',
    ranges: { low: [0, 0], low_borderline: [0, 0], normal: [0, 50], high_borderline: [50, 80], high: [80, Infinity] },
    signal_low: null,
    signal_high: 'intestinal_permeability',
    label: 'Zonuline',
  },
  calprotectine: {
    unit: 'µg/g',
    ranges: { low: [0, 0], low_borderline: [0, 0], normal: [0, 50], high_borderline: [50, 200], high: [200, Infinity] },
    signal_low: null,
    signal_high: 'intestinal_inflammation',
    label: 'Calprotectine',
  },
};

// ─── CLASSIFICATION ───

export function classifyLabValue(markerKey, value) {
  const marker = LAB_MARKERS[markerKey];
  if (!marker || value == null || isNaN(value)) {
    return { classification: 'unknown', label: marker?.label || markerKey, value, unit: marker?.unit || '' };
  }

  const v = Number(value);
  let classification = 'unknown';

  for (const [level, [min, max]] of Object.entries(marker.ranges)) {
    if (v >= min && v < max) {
      classification = level;
      break;
    }
  }

  return {
    classification,
    label: marker.label,
    value: v,
    unit: marker.unit,
    signal: getSignalForClassification(marker, classification),
  };
}

function getSignalForClassification(marker, classification) {
  // Check for level-specific signal override first (e.g. signal_low_borderline)
  const specificKey = `signal_${classification}`;
  if (specificKey in marker) return marker[specificKey];

  // Fallback to general low/high signal
  if (classification === 'low' || classification === 'low_borderline') {
    return marker.signal_low || null;
  }
  if (classification === 'high' || classification === 'high_borderline') {
    return marker.signal_high || null;
  }
  return null;
}

// ─── INTERPRETATION ───

export function interpretLabResults(labResults) {
  // labResults = { ferritine: 25, vitamine_d: 18, glucose_jeun: 105, ... }
  const interpreted = [];
  const signals = [];

  for (const [key, value] of Object.entries(labResults || {})) {
    if (value == null || value === '') continue;
    const result = classifyLabValue(key, value);
    interpreted.push(result);
    if (result.signal) {
      signals.push(result.signal);
    }
  }

  return {
    markers: interpreted,
    signals: [...new Set(signals)],
    summary: buildInterpretationSummary(interpreted),
  };
}

function buildInterpretationSummary(interpreted) {
  const concerns = interpreted.filter(r => r.classification === 'low' || r.classification === 'high');
  const borderline = interpreted.filter(r => r.classification === 'low_borderline' || r.classification === 'high_borderline');
  const normal = interpreted.filter(r => r.classification === 'normal');

  return {
    concerns: concerns.map(r => ({
      label: r.label,
      value: r.value,
      unit: r.unit,
      status: r.classification === 'low' ? 'bas' : 'eleve',
      signal: r.signal,
    })),
    borderline: borderline.map(r => ({
      label: r.label,
      value: r.value,
      unit: r.unit,
      status: r.classification.includes('low') ? 'limite basse' : 'limite haute',
      signal: r.signal,
    })),
    normalCount: normal.length,
    totalAnalyzed: interpreted.length,
  };
}

// ─── NUTRITION ADJUSTMENTS ───

const SIGNAL_TO_ADJUSTMENTS = {
  low_iron_status: {
    label: 'Statut en fer bas',
    dietary: [
      'Augmenter les sources de fer heminique : viande rouge (2-3x/sem), foie, boudin noir',
      'Associer vitamine C aux repas riches en fer (citron, poivron, kiwi)',
      'Eviter the et cafe dans les 2h autour des repas riches en fer',
      'Cuisson en cocotte en fonte si possible',
    ],
    supplement: 'Fer bisglycinate 30mg matin a jeun + vitamine C (si ferritine <30, a discuter avec medecin)',
    caution: 'Ne pas supplementer sans dosage de ferritine prealable',
  },
  iron_overload: {
    label: 'Surcharge en fer',
    dietary: [
      'Reduire viande rouge et abats',
      'Augmenter les chelateurs naturels : the vert, calcium aux repas',
    ],
    supplement: null,
    caution: 'Surcharge en fer a investiguer medicalement (hemochromatose a exclure)',
  },
  low_vitamin_d: {
    label: 'Vitamine D basse',
    dietary: [
      'Augmenter poissons gras (saumon, sardines, maquereau) 2-3x/sem',
      'Exposition solaire moderee 15-20 min/jour si possible',
      'Oeufs, champignons exposes au soleil',
    ],
    supplement: 'Vitamine D3 2000-4000 UI/jour avec repas gras + K2 (a individualiser selon dosage)',
    caution: null,
  },
  excess_vitamin_d: {
    label: 'Vitamine D elevee',
    dietary: ['Revoir supplementation en cours si applicable'],
    supplement: null,
    caution: 'Vitamine D >80 ng/mL — reduire ou stopper la supplementation, controle dans 3 mois',
  },
  low_b12: {
    label: 'Vitamine B12 basse',
    dietary: [
      'Augmenter viandes, poissons, oeufs, produits laitiers',
      'Si regime vegetarien/vegan : supplementation indispensable',
    ],
    supplement: 'Vitamine B12 methylcobalamine 1000 µg/jour avec petit-dejeuner',
    caution: null,
  },
  low_folates: {
    label: 'Folates bas',
    dietary: [
      'Augmenter legumes verts feuillus (epinards, brocoli, roquette)',
      'Legumineuses (lentilles, pois chiches)',
      'Foie (si tolere)',
    ],
    supplement: 'Folates (5-MTHF) 400-800 µg/jour — forme methylee preferee',
    caution: null,
  },
  glycemic_dysregulation: {
    label: 'Dysregulation glycemique',
    dietary: [
      'Reduire sucres rapides et aliments a IG eleve',
      'Privilegier glucides complexes + fibres a chaque repas',
      'Proteines et graisses en debut de repas (ordre alimentaire)',
      'Marche 10-15 min apres les repas',
    ],
    supplement: 'Chrome 200 µg midi avec glucides, magnesium au coucher',
    caution: 'HbA1c >6.4% ou glucose >126 mg/dL — avis medical requis',
  },
  hypoglycemia_tendency: {
    label: 'Tendance hypoglycemique',
    dietary: [
      'Ne pas sauter de repas, fractionner si necessaire',
      'Collation proteines + gras si malaise (noix, fromage)',
      'Eviter glucides isoles (jus, pain blanc seul)',
    ],
    supplement: null,
    caution: null,
  },
  insulin_resistance: {
    label: 'Resistance a l\'insuline',
    dietary: [
      'Reduire charge glycemique globale',
      'Privilegier fibres, proteines, graisses saines a chaque repas',
      'Fenetre alimentaire possible (12-14h) si tolere',
      'Activite physique reguliere (marche post-prandiale)',
    ],
    supplement: 'Chrome 200 µg midi, magnesium bisglycinate 300 mg coucher, berberine (a discuter)',
    caution: 'Insuline >15 µU/mL — investigation metabolique recommandee',
  },
  thyroid_axis_to_monitor: {
    label: 'Axe thyroidien a surveiller',
    dietary: [
      'Assurer apports en iode (poisson, algues moderement)',
      'Selenium via alimentation (noix du Bresil 2-3/jour)',
      'Zinc et fer adequats (cofacteurs thyroidiens)',
      'Eviter exces de cruciferes crus si TSH en limite haute',
    ],
    supplement: 'Selenium 100-200 µg/jour a discuter selon contexte clinique',
    caution: 'Valeur en zone limite — a recontrôler dans 3-6 mois. Si symptomes persistants, avis endocrinologique',
  },
  tsh_high_to_investigate: {
    label: 'TSH haute — investigation recommandee',
    dietary: [
      'Assurer apports en iode, selenium, zinc et fer',
      'Eviter exces de cruciferes crus et soja non fermente',
    ],
    supplement: 'Selenium 100-200 µg/jour, zinc 15-30 mg soir (a discuter avec le medecin)',
    caution: 'TSH >5 mUI/L — avis endocrinologique recommande. Si Levothyroxine en cours : espacement 4h avec calcium/fer/cafe',
  },
  tsh_low_to_investigate: {
    label: 'TSH basse — a investiguer',
    dietary: [
      'Eviter exces d\'iode (algues, sel iode excessif)',
      'Alimentation anti-inflammatoire',
    ],
    supplement: null,
    caution: 'TSH <0.4 mUI/L — avis medical recommande pour exclure une cause hyperthyroidienne',
  },
  thyroid_conversion_to_monitor: {
    label: 'Conversion thyroidienne possiblement reduite',
    dietary: [
      'Selenium via alimentation (noix du Bresil 2-3/jour)',
      'Zinc adequat (viande, graines de courge)',
      'Reduire le stress chronique (le cortisol peut reduire la conversion T4→T3)',
    ],
    supplement: 'Selenium 100-200 µg/jour avec petit-dejeuner, a discuter selon bilan complet',
    caution: null,
  },
  low_grade_inflammation: {
    label: 'Inflammation chronique bas grade',
    dietary: [
      'Augmenter omega-3 : poissons gras 3x/sem, graines de lin, noix',
      'Augmenter polyphenols : fruits rouges, curcuma, the vert',
      'Reduire omega-6 excessifs : huiles de tournesol, friture, ultra-transformes',
      'Augmenter legumes colores et fibres',
    ],
    supplement: 'Omega-3 EPA/DHA 2g/jour midi ou soir avec repas gras, curcuma + piperine midi',
    caution: 'CRP >10 mg/L — origine infectieuse ou inflammatoire a investiguer medicalement',
  },
  low_magnesium: {
    label: 'Magnesium bas',
    dietary: [
      'Augmenter graines de courge, amandes, chocolat noir 85%, epinards, eau minerale riche en Mg',
    ],
    supplement: 'Magnesium bisglycinate 300 mg au coucher',
    caution: null,
  },
  low_zinc: {
    label: 'Zinc bas',
    dietary: [
      'Augmenter viande rouge, fruits de mer (huitres), graines de courge, legumineuses',
    ],
    supplement: 'Zinc bisglycinate 15-30 mg soir avec proteines. Si >8 sem : ajouter cuivre 1-2 mg',
    caution: null,
  },
  // ─── V45 : NOUVEAUX SIGNAUX ETENDUS ───
  high_cholesterol: {
    label: 'Cholesterol total eleve',
    dietary: [
      'Reduire graisses saturees (charcuterie, fromages gras, patisseries industrielles)',
      'Augmenter fibres solubles : avoine, legumineuses, pommes, psyllium',
      'Augmenter omega-3 : poissons gras 3x/sem, noix, graines de lin',
      'Steroles vegetaux naturels (avocat, olives, graines)',
    ],
    supplement: 'Omega-3 EPA/DHA 2g/jour, levure de riz rouge uniquement si LDL tres eleve (avis medical)',
    caution: 'Toujours lire avec le bilan lipidique complet (HDL, LDL, TG)',
  },
  low_hdl: {
    label: 'HDL bas (cholesterol protecteur)',
    dietary: [
      'Augmenter huile d\'olive vierge, avocat, noix',
      'Poissons gras 3x/sem (saumon, sardines, maquereau)',
      'Activite physique reguliere essentielle pour elever HDL',
      'Eviter sucres rapides qui abaissent le HDL',
    ],
    supplement: 'Omega-3 2g/jour avec repas gras',
    caution: null,
  },
  high_ldl: {
    label: 'LDL eleve',
    dietary: [
      'Reduire graisses saturees et trans',
      'Augmenter fibres solubles : avoine, psyllium, legumineuses',
      'Steroles vegetaux naturels (noix, graines, huile olive)',
      'Limiter aliments ultra-transformes',
    ],
    supplement: 'Omega-3 2g/jour, fibres solubles si alimentation insuffisante',
    caution: 'LDL >160 mg/dL persistant — avis medical recommande',
  },
  high_triglycerides: {
    label: 'Triglycerides eleves',
    dietary: [
      'Reduire sucres rapides, alcool, fructose en exces (sodas, jus de fruits)',
      'Limiter glucides raffines (pain blanc, riz blanc)',
      'Augmenter omega-3 (poissons gras) — effet direct sur TG',
      'Activite physique reguliere',
    ],
    supplement: 'Omega-3 EPA/DHA 2-4g/jour',
    caution: 'TG >200 mg/dL — evaluer insulinoresistance, alcool, foie gras',
  },
  high_homocysteine: {
    label: 'Homocysteine elevee',
    dietary: [
      'Augmenter legumes verts feuillus (folates)',
      'Augmenter proteines animales de qualite (B12)',
      'Betterave, oeufs, champignons pour la choline',
    ],
    supplement: '5-MTHF (folates methyles) 400-800 µg + B12 methylcobalamine 1000 µg + B6 P-5-P 25 mg',
    caution: 'Homocysteine >15 µmol/L — verifier statut MTHFR si persistant',
  },
  low_hemoglobin: {
    label: 'Hemoglobine basse (anemie probable)',
    dietary: [
      'Viande rouge 2-3x/sem, foie, boudin noir',
      'Associer vitamine C aux repas (citron, poivron, kiwi)',
      'Eviter the et cafe 2h autour des repas riches en fer',
    ],
    supplement: 'A discuter avec medecin selon cause (fer, B12, folates ou autre)',
    caution: 'Hb <11.5 g/dL (F) ou <12.5 g/dL (H) — diagnostic medical requis',
  },
  low_hematocrite: {
    label: 'Hematocrite bas',
    dietary: [
      'Meme approche que pour hemoglobine basse',
      'Bonne hydratation pour eviter fausses interpretations',
    ],
    supplement: null,
    caution: 'A interpreter avec l\'hemoglobine et la ferritine',
  },
  high_rt3: {
    label: 'T3 reverse elevee (conversion thyroidienne freinee)',
    dietary: [
      'Reduire stress chronique (priorite absolue)',
      'Selenium via noix du Bresil 2-3/jour',
      'Zinc (viande rouge, graines de courge)',
      'Calories suffisantes — eviter restrictions drastiques',
    ],
    supplement: 'Selenium 100-200 µg/jour, a discuter avec bilan thyroidien complet',
    caution: 'T3 reverse >24 ng/dL : investiguer stress, restriction calorique, inflammation',
  },
  autoimmune_thyroid: {
    label: 'Auto-immunite thyroidienne (Hashimoto possible)',
    dietary: [
      'Regime sans gluten strict (benefice clinique chez 80% des Hashimoto)',
      'Reduire produits laitiers si intolerance',
      'Augmenter selenium (noix du Bresil) et zinc',
      'Anti-inflammatoire : omega-3, curcuma, polyphenols',
      'Eviter soja en exces',
    ],
    supplement: 'Selenium 200 µg/jour, Vitamine D3 selon dosage, B12 methylee',
    caution: 'Anti-TPO ou anti-Tg eleves : suivi medical imperatif (endocrinologue)',
  },
  low_iodine: {
    label: 'Iode insuffisant',
    dietary: [
      'Sel iode, algues (wakame, nori) avec moderation',
      'Poissons de mer, fruits de mer',
      'Oeufs, produits laitiers',
    ],
    supplement: 'Iode 150-300 µg/jour (prudence si Hashimoto : avis medical)',
    caution: 'Eviter la supplementation iode si auto-immunite thyroidienne active',
  },
  low_copper: {
    label: 'Cuivre bas',
    dietary: [
      'Foie de veau, huitres, noix de cajou, graines de sesame',
      'Chocolat noir 85%, champignons',
    ],
    supplement: 'Cuivre bisglycinate 1-2 mg/jour si deficit confirme. Jamais sans dosage',
    caution: 'Le zinc en exces chronique reduit le cuivre. Verifier ratio Zn/Cu',
  },
  high_copper: {
    label: 'Cuivre eleve',
    dietary: [
      'Reduire aliments tres riches en cuivre',
      'Augmenter zinc (antagoniste naturel)',
    ],
    supplement: 'Zinc bisglycinate 15-30 mg/jour pour rebalancer',
    caution: 'Cuivre >140 µg/dL persistant : avis medical pour exclure Wilson ou inflammation',
  },
  low_selenium: {
    label: 'Selenium bas',
    dietary: [
      'Noix du Bresil (2-3/jour suffit, tres riches)',
      'Poissons, oeufs, abats, graines de tournesol',
    ],
    supplement: 'Selenium 100-200 µg/jour avec petit-dejeuner',
    caution: 'Eviter doses >400 µg/jour (toxicite possible)',
  },
  intestinal_permeability: {
    label: 'Permeabilite intestinale (leaky gut)',
    dietary: [
      'Retirer gluten strict 4-6 semaines (test)',
      'Reduire produits laitiers et sucres',
      'Bouillon d\'os, aliments fermentes (kefir, choucroute si toleres)',
      'Glutamine via alimentation (viande, poisson, oeufs, legumineuses)',
    ],
    supplement: 'L-glutamine 5g matin a jeun, zinc-carnosine, probiotiques cibles',
    caution: 'Protocole reparation intestinale minimum 8-12 semaines',
  },
  intestinal_inflammation: {
    label: 'Inflammation intestinale (calprotectine elevee)',
    dietary: [
      'Regime anti-inflammatoire strict temporaire',
      'Retirer gluten, produits laitiers, ultra-transformes',
      'Curcuma + piperine midi, omega-3, bone broth',
      'Introduction progressive fibres solubles si toleres',
    ],
    supplement: 'Omega-3 3g/jour, curcuma 500 mg midi, probiotiques cibles (S. boulardii)',
    caution: 'Calprotectine >200 µg/g : avis gastro-enterologue pour exclure MICI',
  },
};

export function getNutritionAdjustmentsFromLabs(labSignals) {
  if (!labSignals || labSignals.length === 0) return [];

  return labSignals
    .map(signal => {
      const adj = SIGNAL_TO_ADJUSTMENTS[signal];
      if (!adj) return null;
      return {
        signal,
        label: adj.label,
        dietary: adj.dietary,
        supplement: adj.supplement,
        caution: adj.caution,
      };
    })
    .filter(Boolean);
}

// ─── FULL PIPELINE ───

export function analyzeLabResults(labResults) {
  const interpretation = interpretLabResults(labResults);
  const adjustments = getNutritionAdjustmentsFromLabs(interpretation.signals);

  return {
    ...interpretation,
    adjustments,
  };
}
