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
