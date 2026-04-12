// MGD Lab Suisse — Mapping symptomes → analyses biologiques et genetiques
// Utilise par NutritionConsultation pour recommander des bilans personnalises

export const MGD_ANALYSIS_MATRIX = {
  fatigue: {
    essential: [
      "Hemogramme complet",
      "Ferritine",
      "Fer serique",
      "Vitamine B12",
      "Folates (B9)",
      "Vitamine D",
      "TSH",
      "Glucose a jeun",
      "HbA1c"
    ],
    relevant: [
      "Insuline a jeun",
      "CRP ultrasensible",
      "Magnesium",
      "Zinc",
      "Cortisol salivaire (profil journalier)"
    ],
    optional: [
      "Homocysteine",
      "Bilan methylation / MTHFR",
      "Profil acides amines",
      "Grand bilan stress oxydant"
    ]
  },

  digestion: {
    essential: [
      "Calprotectine fecale",
      "Zonuline / permeabilite intestinale",
      "Bilan microbiote / metabolome intestinal"
    ],
    relevant: [
      "Recherche parasites",
      "Candida / mycose intestinale",
      "Test SIBO",
      "Bilan inflammation intestinale"
    ],
    optional: [
      "Intolerance lactose",
      "Intolerance fructose",
      "Histamine / DAO",
      "Acides biliaires",
      "Corps cetoniques urinaires"
    ]
  },

  bloating: {
    essential: [
      "Calprotectine fecale",
      "Zonuline / permeabilite intestinale",
      "Bilan microbiote / metabolome intestinal"
    ],
    relevant: [
      "Test SIBO",
      "Recherche parasites",
      "Candida / mycose intestinale",
      "Histamine / DAO"
    ],
    optional: [
      "Intolerance lactose",
      "Intolerance fructose",
      "Bilan colon irritable"
    ]
  },

  metabolic: {
    essential: [
      "Glucose a jeun",
      "Insuline a jeun",
      "HOMA index",
      "HbA1c",
      "Bilan lipidique complet"
    ],
    relevant: [
      "CRP ultrasensible",
      "Profil des acides gras",
      "Cortisol salivaire"
    ],
    optional: [
      "Bilan civilisation",
      "AGEs / glycation",
      "Bilan cardio avance"
    ]
  },

  weight_gain: {
    essential: [
      "Glucose a jeun",
      "Insuline a jeun",
      "HOMA index",
      "HbA1c",
      "Bilan lipidique complet",
      "TSH"
    ],
    relevant: [
      "Cortisol salivaire",
      "CRP ultrasensible"
    ],
    optional: [
      "T3 libre",
      "T4 libre",
      "Reverse T3"
    ]
  },

  inflammation: {
    essential: [
      "CRP ultrasensible",
      "Fibrinogene"
    ],
    relevant: [
      "Profil des acides gras",
      "Homocysteine",
      "Bilan stress oxydant",
      "Vitamines antioxydantes"
    ],
    optional: [
      "Grand bilan stress oxydant",
      "AGEs / glycation",
      "Bilan antioxydants avance"
    ]
  },

  stress: {
    essential: [
      "Cortisol salivaire (profil journalier)"
    ],
    relevant: [
      "Cycle cortisol / melatonine",
      "Magnesium",
      "Vitamine B6",
      "Vitamine B12"
    ],
    optional: [
      "Cortisol libre urinaire 24h",
      "Bilan neurotransmetteurs urinaires",
      "Bilan neurocomportement"
    ]
  },

  sleep: {
    essential: [
      "Cortisol salivaire (profil journalier)"
    ],
    relevant: [
      "Cycle cortisol / melatonine",
      "Magnesium",
      "Vitamine B6"
    ],
    optional: [
      "Bilan neurotransmetteurs urinaires",
      "Cortisol libre urinaire 24h"
    ]
  },

  cravings: {
    essential: [
      "Glucose a jeun",
      "Insuline a jeun",
      "HbA1c"
    ],
    relevant: [
      "Cortisol salivaire",
      "Magnesium",
      "Zinc"
    ],
    optional: [
      "Bilan neurotransmetteurs urinaires",
      "Profil acides amines"
    ]
  },

  skin_hair: {
    essential: [
      "Ferritine",
      "Zinc",
      "Vitamine B12",
      "Folates (B9)",
      "Vitamine D"
    ],
    relevant: [
      "TSH",
      "T3 libre",
      "T4 libre",
      "Bilan dermatologique"
    ],
    optional: [
      "Hormones sexuelles",
      "Profil acides amines"
    ]
  },

  female_hormones: {
    essential: [
      "Bilan hormonal feminin",
      "TSH"
    ],
    relevant: [
      "T3 libre",
      "T4 libre",
      "Bilan SOPK",
      "Bilan androgenes",
      "Cortisol salivaire"
    ],
    optional: [
      "Bilan endometriose",
      "Cycle cortisol / melatonine",
      "Bilan periconception"
    ]
  },

  pms_cycle: {
    essential: [
      "Bilan hormonal feminin",
      "TSH"
    ],
    relevant: [
      "Bilan dysmenorrhee",
      "Bilan androgenes",
      "Cortisol salivaire"
    ],
    optional: [
      "Bilan endometriose",
      "Vitamine D",
      "Magnesium"
    ]
  },

  male_hormones: {
    essential: [
      "Testosterone",
      "SHBG",
      "DHEA"
    ],
    relevant: [
      "Cortisol salivaire",
      "Vitamine D",
      "Zinc",
      "TSH"
    ],
    optional: [
      "Bilan hormonal homme complet"
    ]
  },

  performance: {
    essential: [
      "Hemogramme complet",
      "Ferritine",
      "Vitamine D",
      "Magnesium"
    ],
    relevant: [
      "Zinc",
      "Profil des acides gras",
      "Cortisol salivaire",
      "CRP ultrasensible"
    ],
    optional: [
      "Coenzyme Q10",
      "Profil acides amines",
      "Grand bilan stress oxydant"
    ]
  },

  intolerances: {
    essential: [
      "IgE totales",
      "IgE specifiques"
    ],
    relevant: [
      "IgG alimentaires",
      "DAO / histamine",
      "Intolerance lactose",
      "Intolerance fructose"
    ],
    optional: [
      "Bilan complet intolerances",
      "Metaux lourds"
    ]
  },

  histamine: {
    essential: [
      "DAO / histamine"
    ],
    relevant: [
      "IgE totales",
      "IgE specifiques"
    ],
    optional: [
      "IgG alimentaires",
      "Intolerance lactose",
      "Intolerance fructose"
    ]
  },

  detox_metals: {
    essential: [
      "Metaux lourds sanguins"
    ],
    relevant: [
      "Urines metaux lourds",
      "Bilan complet metaux"
    ],
    optional: [
      "Cheveux / mineraux et oligoelements",
      "Bilan detoxification"
    ]
  },

  thyroid: {
    essential: [
      "TSH",
      "T3 libre",
      "T4 libre"
    ],
    relevant: [
      "Reverse T3",
      "Profil thyroide complet"
    ],
    optional: [
      "Ferritine",
      "Vitamine D",
      "B12"
    ]
  },

  mood_focus: {
    essential: [
      "Cortisol salivaire (profil journalier)"
    ],
    relevant: [
      "Cycle cortisol / melatonine",
      "Vitamine B12",
      "Vitamine B6",
      "Magnesium"
    ],
    optional: [
      "Bilan neurotransmetteurs urinaires",
      "Bilan TDAH / neurocomportement"
    ]
  },

  infections: {
    essential: [
      "Serologies infectieuses de base"
    ],
    relevant: [
      "EBV / CMV / HSV / Hepatites",
      "Borrelia / Lyme",
      "Panel viral ou bacterien selon contexte"
    ],
    optional: [
      "Co-infections Lyme",
      "Bilan infectieux global"
    ]
  }
};

export function dedupe(items = []) {
  return [...new Set(items.filter(Boolean))];
}

export function mergeMGDAnalyses(symptoms = []) {
  const result = {
    essential: [],
    relevant: [],
    optional: []
  };

  symptoms.forEach((symptom) => {
    const entry = MGD_ANALYSIS_MATRIX[symptom];
    if (!entry) return;
    result.essential.push(...(entry.essential || []));
    result.relevant.push(...(entry.relevant || []));
    result.optional.push(...(entry.optional || []));
  });

  result.essential = dedupe(result.essential);

  result.relevant = dedupe(
    result.relevant.filter((item) => !result.essential.includes(item))
  );

  result.optional = dedupe(
    result.optional.filter(
      (item) => !result.essential.includes(item) && !result.relevant.includes(item)
    )
  );

  return result;
}

export function promoteRelevantToEssential(symptoms = [], merged) {
  const symptomCount = symptoms.length;
  if (!merged || symptomCount < 2) return merged;

  const promoteIfPresent = [
    "CRP ultrasensible",
    "Cortisol salivaire (profil journalier)",
    "Magnesium"
  ];

  const essential = new Set(merged.essential);
  const relevant = [];

  merged.relevant.forEach((item) => {
    if (promoteIfPresent.includes(item)) {
      essential.add(item);
    } else {
      relevant.push(item);
    }
  });

  return {
    essential: [...essential],
    relevant,
    optional: merged.optional.filter((item) => !essential.has(item))
  };
}

export function getMGDRecommendations(symptoms = []) {
  const merged = mergeMGDAnalyses(symptoms);
  return promoteRelevantToEssential(symptoms, merged);
}

// ─── ANALYSIS METADATA ───

export const MGD_ANALYSIS_METADATA = {
  "Hemogramme complet": { category: "Hematologie", rationale: ["anemie", "fatigue", "infection", "performance"] },
  "Ferritine": { category: "Micronutrition / fer", rationale: ["fatigue", "recuperation", "chute de cheveux", "performance"] },
  "Fer serique": { category: "Micronutrition / fer", rationale: ["fatigue", "anemie", "concentration"] },
  "Vitamine B12": { category: "Micronutrition / vitamines B", rationale: ["fatigue", "cognition", "methylation", "humeur"] },
  "Folates (B9)": { category: "Micronutrition / vitamines B", rationale: ["fatigue", "methylation", "fertilite", "humeur"] },
  "Vitamine D": { category: "Micronutrition / vitamine D", rationale: ["immunite", "os", "fatigue", "humeur", "performance"] },
  "TSH": { category: "Thyroide", rationale: ["fatigue", "prise de poids", "metabolisme", "humeur"] },
  "T3 libre": { category: "Thyroide", rationale: ["metabolisme", "energie", "perte de poids", "thyroide"] },
  "T4 libre": { category: "Thyroide", rationale: ["metabolisme", "thyroide", "fatigue"] },
  "Reverse T3": { category: "Thyroide", rationale: ["stress chronique", "thyroide", "conversion T4/T3"] },
  "Glucose a jeun": { category: "Metabolisme glucidique", rationale: ["glycemie", "diabete", "energie", "fringales"] },
  "Insuline a jeun": { category: "Metabolisme glucidique", rationale: ["resistance insuline", "prise de poids", "fringales"] },
  "HOMA index": { category: "Metabolisme glucidique", rationale: ["resistance insuline", "syndrome metabolique"] },
  "HbA1c": { category: "Metabolisme glucidique", rationale: ["glycemie moyenne", "diabete", "inflammation"] },
  "Bilan lipidique complet": { category: "Metabolisme lipidique", rationale: ["cholesterol", "cardiovasculaire", "inflammation"] },
  "CRP ultrasensible": { category: "Inflammation", rationale: ["inflammation chronique", "risque cardiovasculaire", "infection"] },
  "Fibrinogene": { category: "Inflammation", rationale: ["inflammation", "coagulation", "risque cardiovasculaire"] },
  "Magnesium": { category: "Micronutrition / mineraux", rationale: ["stress", "sommeil", "crampes", "fatigue", "humeur"] },
  "Zinc": { category: "Micronutrition / mineraux", rationale: ["immunite", "peau", "fertilite", "cicatrisation"] },
  "Vitamine B6": { category: "Micronutrition / vitamines B", rationale: ["humeur", "sommeil", "neurotransmetteurs", "SPM"] },
  "Cortisol salivaire (profil journalier)": { category: "Axe stress / surrenales", rationale: ["stress", "fatigue", "sommeil", "burn-out"] },
  "Cortisol salivaire": { category: "Axe stress / surrenales", rationale: ["stress", "fatigue", "surrenales"] },
  "Cycle cortisol / melatonine": { category: "Axe stress / sommeil", rationale: ["sommeil", "rythme circadien", "stress"] },
  "Calprotectine fecale": { category: "Digestion / inflammation", rationale: ["inflammation intestinale", "MICI", "colite"] },
  "Zonuline / permeabilite intestinale": { category: "Digestion / barriere intestinale", rationale: ["permeabilite", "intolerances", "auto-immunite"] },
  "Bilan microbiote / metabolome intestinal": { category: "Digestion / microbiote", rationale: ["dysbiose", "digestion", "immunite", "humeur"] },
  "Recherche parasites": { category: "Digestion / infections", rationale: ["ballonnements", "diarrhee", "fatigue digestive"] },
  "Candida / mycose intestinale": { category: "Digestion / infections", rationale: ["fringales sucre", "ballonnements", "fatigue"] },
  "Test SIBO": { category: "Digestion / SIBO", rationale: ["ballonnements", "gaz", "malabsorption"] },
  "Bilan inflammation intestinale": { category: "Digestion / inflammation", rationale: ["inflammation", "digestion", "douleurs abdominales"] },
  "Histamine / DAO": { category: "Intolerances / histamine", rationale: ["migraines", "urticaire", "digestion", "intolerances"] },
  "Intolerance lactose": { category: "Intolerances alimentaires", rationale: ["ballonnements", "diarrhee", "lactose"] },
  "Intolerance fructose": { category: "Intolerances alimentaires", rationale: ["ballonnements", "diarrhee", "fructose"] },
  "Profil des acides gras": { category: "Micronutrition / lipides", rationale: ["inflammation", "omega-3/6", "cardiovasculaire", "cognition"] },
  "Homocysteine": { category: "Methylation / cardiovasculaire", rationale: ["methylation", "cardiovasculaire", "cognition", "MTHFR"] },
  "Bilan methylation / MTHFR": { category: "Genetique / methylation", rationale: ["methylation", "fatigue", "humeur", "detox"] },
  "Profil acides amines": { category: "Micronutrition / proteines", rationale: ["recuperation", "neurotransmetteurs", "performance"] },
  "Grand bilan stress oxydant": { category: "Stress oxydant", rationale: ["vieillissement", "inflammation", "sport intensif"] },
  "Bilan stress oxydant": { category: "Stress oxydant", rationale: ["vieillissement", "inflammation"] },
  "Vitamines antioxydantes": { category: "Stress oxydant", rationale: ["protection cellulaire", "anti-age"] },
  "Testosterone": { category: "Hormones masculines", rationale: ["libido", "masse musculaire", "energie", "humeur"] },
  "SHBG": { category: "Hormones", rationale: ["biodisponibilite hormonale", "testosterone libre"] },
  "DHEA": { category: "Hormones / surrenales", rationale: ["vitalite", "anti-age", "surrenales"] },
  "Bilan hormonal feminin": { category: "Hormones feminines", rationale: ["cycle", "fertilite", "SPM", "menopause"] },
  "Bilan SOPK": { category: "Hormones feminines", rationale: ["SOPK", "acne", "pilosite", "cycles irreguliers"] },
  "Bilan androgenes": { category: "Hormones", rationale: ["acne", "pilosite", "libido", "SOPK"] },
  "Bilan dysmenorrhee": { category: "Hormones feminines", rationale: ["douleurs menstruelles", "cycle"] },
  "Bilan endometriose": { category: "Hormones feminines", rationale: ["douleurs pelviennes", "endometriose", "fertilite"] },
  "IgE totales": { category: "Allergologie", rationale: ["allergies", "terrain atopique"] },
  "IgE specifiques": { category: "Allergologie", rationale: ["allergies specifiques", "identification allergenes"] },
  "IgG alimentaires": { category: "Intolerances alimentaires", rationale: ["intolerances", "inflammation", "digestion"] },
  "DAO / histamine": { category: "Intolerances / histamine", rationale: ["histamine", "migraines", "digestion"] },
  "Metaux lourds sanguins": { category: "Toxicologie", rationale: ["intoxication", "fatigue", "cognition", "detox"] },
  "Urines metaux lourds": { category: "Toxicologie", rationale: ["elimination metaux", "detox"] },
  "Bilan complet metaux": { category: "Toxicologie", rationale: ["bilan toxicologique complet"] },
  "Cheveux / mineraux et oligoelements": { category: "Micronutrition / mineraux", rationale: ["statut mineral", "metaux lourds", "oligoelements"] },
  "Bilan detoxification": { category: "Detoxification", rationale: ["foie", "phase I/II", "detox"] },
  "Coenzyme Q10": { category: "Micronutrition / energie", rationale: ["energie cellulaire", "coeur", "statines"] },
  "Bilan neurotransmetteurs urinaires": { category: "Neurotransmetteurs", rationale: ["humeur", "sommeil", "anxiete", "concentration"] },
  "Bilan neurocomportement": { category: "Neurotransmetteurs", rationale: ["TDAH", "concentration", "comportement"] },
  "Cortisol libre urinaire 24h": { category: "Axe stress / surrenales", rationale: ["cortisol total", "surrenales", "Cushing"] },
  "Serologies infectieuses de base": { category: "Infectiologie", rationale: ["infections chroniques", "fatigue inexpliquee"] },
  "EBV / CMV / HSV / Hepatites": { category: "Infectiologie", rationale: ["virus latents", "fatigue chronique"] },
  "Borrelia / Lyme": { category: "Infectiologie", rationale: ["Lyme", "fatigue", "douleurs articulaires"] },
  "Profil thyroide complet": { category: "Thyroide", rationale: ["thyroide complete", "auto-immunite thyroidienne"] },
  "Hormones sexuelles": { category: "Hormones", rationale: ["libido", "fertilite", "peau", "cheveux"] },
  "Bilan dermatologique": { category: "Dermatologie", rationale: ["peau", "eczema", "acne", "psoriasis"] },
  "Acides biliaires": { category: "Digestion / foie", rationale: ["digestion graisses", "foie", "bile"] },
  "Corps cetoniques urinaires": { category: "Metabolisme", rationale: ["cetose", "diabete", "jeune"] },
  "Bilan civilisation": { category: "Bilan global", rationale: ["bilan preventif", "mode de vie"] },
  "AGEs / glycation": { category: "Vieillissement", rationale: ["glycation", "vieillissement", "diabete"] },
  "Bilan cardio avance": { category: "Cardiovasculaire", rationale: ["risque cardiovasculaire avance"] },
  "Bilan complet intolerances": { category: "Intolerances alimentaires", rationale: ["bilan global intolerances"] },
  "Bilan colon irritable": { category: "Digestion", rationale: ["SII", "colon irritable", "douleurs abdominales"] },
  "Bilan periconception": { category: "Hormones feminines", rationale: ["fertilite", "grossesse", "preconception"] },
  "Bilan hormonal homme complet": { category: "Hormones masculines", rationale: ["bilan complet", "andropause"] },
  "Bilan TDAH / neurocomportement": { category: "Neurotransmetteurs", rationale: ["TDAH", "concentration", "impulsivite"] },
  "Co-infections Lyme": { category: "Infectiologie", rationale: ["co-infections", "Bartonella", "Babesia"] },
  "Bilan infectieux global": { category: "Infectiologie", rationale: ["bilan infectieux complet"] },
  "Bilan antioxydants avance": { category: "Stress oxydant", rationale: ["bilan antioxydant complet"] },
  "Panel viral ou bacterien selon contexte": { category: "Infectiologie", rationale: ["infections specifiques au contexte"] },
};

function getAnalysisMetadata(testName) {
  const meta = MGD_ANALYSIS_METADATA[testName];
  if (meta) {
    return { label: testName, category: meta.category, rationale: meta.rationale };
  }
  return { label: testName, category: "Analyse fonctionnelle", rationale: [] };
}

export function enrichMGDRecommendations(recommendations) {
  return {
    essential: (recommendations.essential || []).map(t => ({ ...getAnalysisMetadata(t), priority: 'essential' })),
    relevant: (recommendations.relevant || []).map(t => ({ ...getAnalysisMetadata(t), priority: 'relevant' })),
    optional: (recommendations.optional || []).map(t => ({ ...getAnalysisMetadata(t), priority: 'optional' })),
  };
}

export function getEnrichedMGDRecommendations(symptoms = []) {
  const recs = getMGDRecommendations(symptoms);
  return enrichMGDRecommendations(recs);
}
