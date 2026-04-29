// V94.18 : Anamnese Analyzer Premium
// Scrute exhaustivement le formulaire client et retourne un contexte structure
// pour guider la generation de tests biologiques pertinents (Fiche Medecin)
// et les recommandations nutritionnelles (MGD).
//
// Output : { symptoms, pathologies, traitements, familyHistory, demographics,
//            lifestyle, redFlags, suggestedTests }

// ─── HELPERS REGEX ─────────────────────────────────────────────────

const RE_DIABETE_T1   = /diab[eè]te\s*(?:de\s+)?type\s*1\b|diab[eè]te\s*t\s*1\b|dt1\b|insuline\s*(?:pompe|sous|stylo)/i;
const RE_DIABETE_T2   = /diab[eè]te\s*(?:de\s+)?type\s*2\b|diab[eè]te\s*t\s*2\b|dt2\b|insulino[\s-]?r[eé]sistance|metform/i;
const RE_HYPOTHYROIDIE = /hypothyro[iï]die|hashimoto|levothyrox|euthyrox|tirosint|t4\s+basse/i;
const RE_HYPERTHYROIDIE = /hyperthyro[iï]die|basedow|graves|carbimazole/i;
const RE_SOPK         = /sopk\b|s\.o\.p\.k\.|polykyst[ie]\s*ovaire|ovaire\s+polykyst/i;
const RE_HTN          = /hypertension|htn\b|tension\s+(?:elevee|haute)|hta\b/i;
const RE_DYSLIPIDEMIE = /dyslipid[eé]mie|cholest[eé]rol\s+(?:eleve|haut)|hypertriglyc[eé]rid|hyperchol/i;
const RE_GROSSESSE_ENCOURS = /enceinte|grossesse\s*(?:en\s+cours|active)|trimestre/i;
const RE_GROSSESSE_PROJET  = /projet|essai|envisage|souhaite|essaie/i;
const RE_MENOPAUSE     = /m[eé]nopause|post[\s-]?m[eé]nopaus|sans\s+r[eè]gles|amenorrhee/i;
const RE_PERIMENOPAUSE = /p[eé]rim[eé]nopause|pr[eé]m[eé]nopause/i;
const RE_RETINOPATHIE  = /r[eé]tinopath/i;
const RE_NEPHROPATHIE  = /n[eé]phropath|microalbumin/i;
const RE_GONARTHROSE   = /gonarthrose|arthrose/i;
const RE_DERMATITE     = /dermatite|eczema|psoriasis|couperose|s[eé]borrh/i;
const RE_DEPRESSION    = /d[eé]pression|antid[eé]presseur|prozac|zoloft|deroxat|sertraline|fluoxetine/i;
const RE_TDAH          = /tdah\b|adhd\b|hyperactiv|trouble\s+attention/i;
const RE_ANXIETE       = /anxi[eé]t[eé]|anxiolytique|xanax|lexomil|stresam/i;
const RE_DOULEURS_CHRONIQUES = /douleur(?:s)?\s+chronique|fibromyalgie|migraine\s+chronique/i;
const RE_FATIGUE_CHRONIQUE = /fatigue\s+chronique|sfc\b|burn[\s-]?out/i;
const RE_INSULINE_POMPE = /pompe\s+(?:a\s+)?insuline|menimed|tandem|omnipod/i;
const RE_AVK            = /avk\b|sintrom|previscan|coumadine|warfarine|fluindione/i;
const RE_DOAC           = /xarelto|eliquis|pradaxa|lixiana|rivaroxaban|apixaban|dabigatran|edoxaban/i;
const RE_LEVOTHYROX     = /levothyrox|euthyrox|tirosint|l-thyroxine/i;
const RE_IPP            = /inexium|mopral|pantopraz|omepraz|esomepraz|lansopraz|ipp\b|antiacide\s+chronique/i;
const RE_STATINES       = /statin[ae]|atorvastat|rosuvastat|simvastat|pravastat|crestor|tahor|lipitor/i;
const RE_METFORMINE     = /metform|glucophage|stagid/i;
const RE_INSULINE_TT    = /insuline|humalog|novorapid|lantus|levemir|tresiba|toujeo/i;
const RE_PILULE         = /pilule|contracept(?:if|ion).*hormonale|jasmine|leeloo|optilova|microval/i;
const RE_DIU_HORMONAL   = /st[eé]rilet\s+hormonal|mirena|jaydess|kyleena/i;
const RE_BIOTHERAPIE    = /humira|enbrel|remicade|cosentyx|stelara|biothera/i;
const RE_CORTICOIDES    = /corticoide|prednisone|cortancyl|solupred|medrol/i;
const RE_LITHIUM        = /lithium|teralithe/i;
const RE_FAM_DIABETE    = /diab[eè]te/i;
const RE_FAM_CARDIO     = /infarctus|avc\b|crise\s+cardiaque|angor|cardiopath|cardio[\s-]?vasculair/i;
const RE_FAM_CANCER_SEIN = /cancer\s+(?:du\s+)?sein|sein\s+cancer/i;
const RE_FAM_CANCER_COLON = /cancer\s+(?:du\s+)?colon|colorectal/i;
const RE_FAM_THYROIDE   = /thyro[iï]d/i;
const RE_FAM_OSTEOPOROSE = /ost[eé]oporose|fracture\s+col\s+f[eé]mur/i;

const has = (s, re) => Boolean(s && re.test(s));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ─── DETECTION PATHOLOGIES ─────────────────────────────────────────

function detectPathologies(form) {
  const path = (form.pathologies || '').toString();
  const trait = (form.traitements || '').toString() + ' ' + (form.medicaments || '').toString();
  const all = path + ' ' + trait;

  return {
    diabete_t1: {
      active: has(all, RE_DIABETE_T1),
      hasPump: has(all, RE_INSULINE_POMPE),
      complications: {
        retinopathie: has(path, RE_RETINOPATHIE),
        nephropathie: has(path, RE_NEPHROPATHIE),
      },
    },
    diabete_t2: {
      active: !has(all, RE_DIABETE_T1) && has(all, RE_DIABETE_T2),
    },
    hypothyroidie: {
      active: has(all, RE_HYPOTHYROIDIE),
      auto_immune: has(all, /hashimoto/i),
    },
    hyperthyroidie: {
      active: has(all, RE_HYPERTHYROIDIE),
    },
    sopk: { active: has(all, RE_SOPK) },
    htn: { active: has(all, RE_HTN) },
    dyslipidemie: { active: has(all, RE_DYSLIPIDEMIE) },
    gonarthrose: { active: has(all, RE_GONARTHROSE) },
    dermatite: { active: has(all, RE_DERMATITE) },
    depression: { active: has(all, RE_DEPRESSION) },
    tdah: { active: has(all, RE_TDAH) },
    anxiete: { active: has(all, RE_ANXIETE) },
    douleurs_chroniques: { active: has(all, RE_DOULEURS_CHRONIQUES) },
    fatigue_chronique: { active: has(all, RE_FATIGUE_CHRONIQUE) },
  };
}

// ─── DETECTION TRAITEMENTS ─────────────────────────────────────────

function detectTreatments(form) {
  const t = (form.traitements || '').toString() + ' ' + (form.medicaments || '').toString();

  return {
    avk: {
      active: has(t, RE_AVK),
      tests: ['INR'],
      interactions: ['Vitamine K2 forte dose', 'Omega-3 forte dose (>3g)', 'Millepertuis'],
    },
    doac: {
      active: has(t, RE_DOAC),
      tests: ['Fonction renale (creatinine, DFG)', 'Bilan hepatique'],
      interactions: ['IPP (modifie absorption Pradaxa)', 'Millepertuis'],
    },
    levothyrox: {
      active: has(t, RE_LEVOTHYROX),
      tests: ['TSH', 'T4 libre'],
      interactions: ['Soja a distance 4h', 'Calcium a distance 4h', 'Fer a distance 4h', 'IPP a distance'],
    },
    ipp: {
      active: has(t, RE_IPP),
      tests: ['B12', 'Magnesium', 'Ferritine', '25-OH Vit D'],
      interactions: ['Fer (absorption reduite)', 'Calcium', 'B12'],
    },
    statines: {
      active: has(t, RE_STATINES),
      tests: ['CK', 'ASAT/ALAT/GGT', 'CoQ10 (a evaluer)'],
      interactions: ['Pamplemousse', 'Millepertuis'],
    },
    metformine: {
      active: has(t, RE_METFORMINE),
      tests: ['HbA1c', 'B12 (carence frequente)', 'Fonction renale (DFG)'],
    },
    insuline: {
      active: has(t, RE_INSULINE_TT),
      pompe: has(t, RE_INSULINE_POMPE),
      tests: ['HbA1c', 'Microalbuminurie', 'Fond d\u2019oeil annuel', 'Bilan lipidique'],
      interactions: ['Berberine', 'Chrome', 'Cannelle (potentialise)', 'Vinaigre cidre'],
    },
    pilule: {
      active: has(t, RE_PILULE),
      tests: ['Bilan lipidique', 'TSH', 'Vit B6', 'B9'],
      interactions: ['Millepertuis (reduit efficacite)'],
    },
    diu_hormonal: {
      active: has(t, RE_DIU_HORMONAL),
      tests: [],
    },
    biotherapie: {
      active: has(t, RE_BIOTHERAPIE),
      tests: ['NFS', 'Bilan hepatique', 'CRP'],
    },
    corticoides: {
      active: has(t, RE_CORTICOIDES),
      tests: ['Glycemie a jeun', 'TA', 'DXA si > 3 mois', 'Calcium / Vit D'],
    },
    lithium: {
      active: has(t, RE_LITHIUM),
      tests: ['Lithemie', 'TSH', 'Creatinine'],
      interactions: ['Hydratation a maintenir', 'AINS'],
    },
    antidepresseurs: {
      active: has(t, /sertraline|fluoxetine|prozac|deroxat|escitalopram|venlafaxine|cymbalta|effexor|isrs\b|irsna\b/i),
      tests: ['Bilan hepatique', 'Sodium (hyponatremie ISRS)'],
      interactions: ['Millepertuis', 'Tramadol (syndrome serotoninergique)'],
    },
  };
}

// ─── ANTECEDENTS FAMILIAUX ─────────────────────────────────────────

function detectFamilyHistory(form) {
  const f = (form.antecedentsFamiliaux || '').toString();
  return {
    diabete: has(f, RE_FAM_DIABETE),
    cv_precoce: has(f, RE_FAM_CARDIO) || /pere|pre|<\s*55/.test(f.toLowerCase()),
    cancer_sein: has(f, RE_FAM_CANCER_SEIN),
    cancer_colon: has(f, RE_FAM_CANCER_COLON),
    thyroide: has(f, RE_FAM_THYROIDE),
    osteoporose: has(f, RE_FAM_OSTEOPOROSE),
  };
}

// ─── DEMOGRAPHIES + GROSSESSE / MENOPAUSE ──────────────────────────

function detectDemographics(form) {
  const age = num(form.age);
  const genre = (form.genre || '').toString().toLowerCase();
  const isFemme = /f|femme|w/.test(genre);
  const isHomme = /h|homme|m\b/.test(genre);
  const poids = num(form.poids);
  const taille = num(form.taille);
  const imc = (poids && taille) ? Number((poids / Math.pow(taille / 100, 2)).toFixed(1)) : null;

  let imcCategory = null;
  if (imc !== null) {
    if (imc < 18.5) imcCategory = 'maigreur';
    else if (imc < 25) imcCategory = 'normal';
    else if (imc < 30) imcCategory = 'surpoids';
    else if (imc < 35) imcCategory = 'obesite_1';
    else if (imc < 40) imcCategory = 'obesite_2';
    else imcCategory = 'obesite_3';
  }

  // Cycle / menopause
  const cycleText = [form.cycleDuree, form.spm, form.contraception, form.projetGrossesse, form.pathologies]
    .filter(Boolean).join(' ');
  const grossesseEnCours = isFemme && has(cycleText, RE_GROSSESSE_ENCOURS);
  const grossesseProjet  = isFemme && !grossesseEnCours && has((form.projetGrossesse || '').toString(), RE_GROSSESSE_PROJET);
  const menopause     = isFemme && has(cycleText, RE_MENOPAUSE);
  const perimenopause = isFemme && has(cycleText, RE_PERIMENOPAUSE);

  // Cohorte
  let cohort = 'unknown';
  if (isHomme) {
    if (age >= 65) cohort = 'homme_senior';
    else if (age >= 50) cohort = 'homme_50_plus';
    else if (age >= 30) cohort = 'homme_actif';
    else cohort = 'homme_jeune';
  } else if (isFemme) {
    if (menopause) cohort = 'femme_menopausee';
    else if (perimenopause || (age >= 45)) cohort = 'femme_perimenopause';
    else if (grossesseEnCours) cohort = 'femme_enceinte';
    else if (grossesseProjet) cohort = 'femme_projet_grossesse';
    else if (age >= 30) cohort = 'femme_active';
    else cohort = 'femme_jeune';
  }

  return { age, genre, isFemme, isHomme, poids, taille, imc, imcCategory,
           grossesseEnCours, grossesseProjet, menopause, perimenopause, cohort };
}

// ─── LIFESTYLE ─────────────────────────────────────────────────────

function detectLifestyle(form) {
  const tabacS = (form.tabac || '').toString().toLowerCase();
  const alcoolS = (form.alcool || '').toString().toLowerCase();
  const sportS  = (form.frequenceSport || '').toString().toLowerCase();
  const heuresSommeil = num(form.heuresSommeil);
  const stress = num(form.niveauStressActuel);
  const hydratationS = (form.hydratation || '').toString().toLowerCase();
  const tourTaille = num(form.tourTaille);

  const tabacActif = /oui|fumeur|actif|paquet/.test(tabacS) && !/non|jamais|stoppe|arrete/.test(tabacS);
  const alcoolFrequent = /quotidien|tous\s+les\s+jours|frequent|3\s*\+|>3/.test(alcoolS);
  const alcoolModere = !alcoolFrequent && /(\d+\s*verre|hebdomadair|week-end|occasionnel)/.test(alcoolS);
  const sedentaire = /aucun|jamais|sedentaire|pas\s+de\s+sport/.test(sportS) || /0\s*x|0\/sem/.test(sportS);
  const sportIntensif = /quotidien|6x|7x|tous|intensif|haut\s+niveau|comp[eé]tition/.test(sportS);

  // Hydratation : detecte les chiffres dans le texte
  let hydratationLitres = null;
  const litreMatch = hydratationS.match(/(\d+(?:[.,]\d+)?)\s*(l|litre)/);
  if (litreMatch) hydratationLitres = parseFloat(litreMatch[1].replace(',', '.'));
  const hydratationBasse = hydratationLitres !== null && hydratationLitres < 1.5;

  // Risque cardiovasculaire abdominal
  const tourTailleHaut = tourTaille && (
    (form.genre || '').toLowerCase().match(/^h|homme|m\b/) ? tourTaille >= 102 : tourTaille >= 88
  );

  return {
    tabacActif,
    alcoolFrequent,
    alcoolModere,
    sedentaire,
    sportIntensif,
    heuresSommeil,
    sommeilCourt: heuresSommeil !== null && heuresSommeil < 7,
    sommeilTresCourt: heuresSommeil !== null && heuresSommeil < 6,
    stress,
    stressEleve: stress !== null && stress >= 7,
    stressMaximal: stress !== null && stress >= 9,
    hydratationLitres,
    hydratationBasse,
    tourTaille,
    tourTailleHaut,
  };
}

// ─── SYMPTOMES (etend l'existant) ──────────────────────────────────

function detectSymptomsExtended(form, demo) {
  const symptoms = new Set();
  const f = form || {};

  if (f.energieJournee && Number(f.energieJournee) <= 2) symptoms.add('fatigue');
  if (f.frequenceBallonnements && Number(f.frequenceBallonnements) <= 2) { symptoms.add('digestion'); symptoms.add('bloating'); }
  else if (f.frequenceBallonnements && Number(f.frequenceBallonnements) <= 3) symptoms.add('digestion');
  if (f.niveauStressActuel && Number(f.niveauStressActuel) >= 7) symptoms.add('stress');
  if (f.heuresSommeil && Number(f.heuresSommeil) <= 5) symptoms.add('sleep');
  if (f.difficultesEndormissement && /oui|souvent|regulier/i.test(f.difficultesEndormissement)) symptoms.add('sleep');
  if (f.fringalesSucre && /oui|souvent|regulier|fort/i.test(f.fringalesSucre)) symptoms.add('cravings');
  if (f.douleursInflammations && f.douleursInflammations.trim()) symptoms.add('inflammation');
  if (f.troublesPeau && f.troublesPeau.trim()) symptoms.add('skin_hair');
  if (f.transitType && /constip/i.test(f.transitType)) symptoms.add('digestion');
  if (f.spm && /oui|fort|regulier/i.test(f.spm)) symptoms.add('pms_cycle');
  if (f.douleursMenstruelles && /oui|fort|regulier/i.test(f.douleursMenstruelles)) symptoms.add('pms_cycle');
  // Variations glycemie reportees
  if (f.variationsGlycemie && /(oui|frequent|tous\s+les\s+jours)/i.test(f.variationsGlycemie)) symptoms.add('glycemic_instability');
  // IMC eleve -> metabolique
  if (demo.imcCategory && /surpoids|obesite/.test(demo.imcCategory)) { symptoms.add('weight_gain'); symptoms.add('metabolic'); }
  // Tour de taille eleve -> insulinoresistance
  if (demo.tourTailleHaut) symptoms.add('metabolic');

  // Objectifs
  const obj = (f.objectifPrincipalNutrition || f.objectifPrincipal || '').toLowerCase();
  if (/poids|perte/.test(obj)) { symptoms.add('weight_gain'); symptoms.add('metabolic'); }
  if (/hormone/.test(obj)) symptoms.add('female_hormones');
  if (/performance/.test(obj)) symptoms.add('performance');
  if (/digestion/.test(obj)) symptoms.add('digestion');
  if (/energie|fatigue/.test(obj)) symptoms.add('fatigue');

  return [...symptoms];
}

// ─── SUGGESTIONS DE TESTS BIOLOGIQUES ──────────────────────────────
// Calcule une liste priorisee d'examens a proposer au medecin selon
// les contextes detectes. Chaque test = { test, priority, reason, source }

function buildSuggestedTests(ctx) {
  const { pathologies, traitements, familyHistory, demographics, lifestyle, symptoms } = ctx;
  const tests = [];
  const addedKeys = new Set();
  const add = (test, priority, reason, source) => {
    const key = test.toLowerCase();
    if (addedKeys.has(key)) return;
    addedKeys.add(key);
    tests.push({ test, priority, reason, source });
  };

  // ── PATHOLOGIES ──
  if (pathologies.diabete_t1.active) {
    add('HbA1c', 'essentiel', 'Diabete T1, suivi du controle glycemique', 'pathologie');
    add('Microalbuminurie', 'essentiel', 'Diabete T1, depistage nephropathie', 'pathologie');
    add('Fond d\u2019oeil', 'essentiel', 'Diabete T1, depistage retinopathie annuelle', 'pathologie');
    add('Bilan lipidique complet', 'recommande', 'Diabete T1, risque cardiovasculaire majore', 'pathologie');
    if (pathologies.diabete_t1.complications.retinopathie) {
      add('CRP ultrasensible', 'recommande', 'Retinopathie deja active, surveillance inflammation', 'pathologie');
    }
  }
  if (pathologies.diabete_t2.active) {
    add('HbA1c', 'essentiel', 'Diabete T2, suivi controle', 'pathologie');
    add('Glycemie a jeun', 'essentiel', 'Diabete T2', 'pathologie');
    add('Insuline a jeun + HOMA-IR', 'recommande', 'Diabete T2, evaluation resistance insulinique', 'pathologie');
    add('Microalbuminurie', 'recommande', 'Diabete T2, depistage nephropathie', 'pathologie');
  }
  if (pathologies.hypothyroidie.active) {
    add('TSH', 'essentiel', 'Hypothyroidie sous traitement, suivi', 'pathologie');
    add('T4 libre', 'essentiel', 'Hypothyroidie, dosage actif', 'pathologie');
    if (pathologies.hypothyroidie.auto_immune) {
      add('Anti-TPO', 'recommande', 'Hashimoto suspecte, confirmation auto-immune', 'pathologie');
    }
  }
  if (pathologies.sopk.active) {
    add('Insuline a jeun + HOMA-IR', 'essentiel', 'SOPK, evaluation resistance insulinique', 'pathologie');
    add('Testosterone totale + libre', 'essentiel', 'SOPK, hyperandrogenie', 'pathologie');
    add('LH/FSH ratio', 'recommande', 'SOPK, profil hormonal', 'pathologie');
    add('Bilan lipidique', 'recommande', 'SOPK, risque metabolique majore', 'pathologie');
  }
  if (pathologies.htn.active) {
    add('Ionogramme sanguin', 'recommande', 'HTA, surveillance Na/K sous traitement', 'pathologie');
    add('Creatinine + DFG', 'recommande', 'HTA, fonction renale', 'pathologie');
  }
  if (pathologies.dyslipidemie.active) {
    add('Bilan lipidique complet (LDL, HDL, TG)', 'essentiel', 'Dyslipidemie connue, suivi', 'pathologie');
    add('CRP ultrasensible', 'recommande', 'Inflammation associee dyslipidemie', 'pathologie');
  }
  if (pathologies.depression.active || pathologies.anxiete.active) {
    add('Vitamine D 25-OH', 'recommande', 'Depression / anxiete, lien avec statut Vit D', 'pathologie');
    add('Homocysteine', 'recommande', 'Trouble humeur, methylation a evaluer', 'pathologie');
    add('B12 + folates', 'recommande', 'Trouble humeur, vitamines B critiques', 'pathologie');
  }
  if (pathologies.fatigue_chronique.active) {
    add('Cortisol matin', 'essentiel', 'Fatigue chronique, axe HPA', 'pathologie');
    add('Ferritine + bilan martial', 'essentiel', 'Fatigue chronique, statut fer', 'pathologie');
  }

  // ── TRAITEMENTS (interactions + monitoring) ──
  for (const [, t] of Object.entries(traitements)) {
    if (!t.active || !t.tests) continue;
    for (const test of t.tests) {
      add(test, 'essentiel', 'Surveillance traitement en cours', 'traitement');
    }
  }

  // ── ANTECEDENTS FAMILIAUX ──
  if (familyHistory.diabete && demographics.age >= 30) {
    add('HbA1c', 'recommande', 'Antecedent familial diabete, depistage', 'famille');
    add('Glycemie a jeun', 'recommande', 'Antecedent familial diabete', 'famille');
  }
  if (familyHistory.cv_precoce) {
    add('Bilan lipidique complet', 'recommande', 'Antecedent cardiovasculaire familial precoce', 'famille');
    add('Lp(a)', 'optionnel', 'CV precoce familial, marqueur genetique', 'famille');
    add('Apo B', 'optionnel', 'CV familial, atherogenicite', 'famille');
  }
  if (familyHistory.thyroide && !pathologies.hypothyroidie.active) {
    add('TSH', 'recommande', 'Antecedent familial thyroide', 'famille');
  }
  if (familyHistory.osteoporose && demographics.cohort.includes('menopaus')) {
    add('25-OH Vit D', 'recommande', 'Risque osteoporose familial + menopause', 'famille');
    add('Calcium serique', 'recommande', 'Risque osteoporose familial', 'famille');
  }

  // ── DEMOGRAPHIE ──
  if (demographics.cohort === 'femme_jeune' || demographics.cohort === 'femme_active') {
    if (!addedKeys.has('ferritine + bilan martial')) {
      add('Ferritine + bilan martial', 'recommande', 'Femme en age de procreer, statut fer', 'demographie');
    }
  }
  if (demographics.cohort === 'femme_projet_grossesse' || demographics.cohort === 'femme_enceinte') {
    add('Ferritine + bilan martial', 'essentiel', 'Projet/grossesse, statut fer critique', 'demographie');
    add('B12 + folates (B9)', 'essentiel', 'Projet/grossesse, prevention anomalies neurales', 'demographie');
    add('25-OH Vit D', 'essentiel', 'Projet/grossesse, soutien fixation calcique mere/bebe', 'demographie');
    add('TSH', 'essentiel', 'Projet/grossesse, fonction thyroidienne', 'demographie');
    if (demographics.cohort === 'femme_enceinte') {
      add('Glycemie a jeun', 'essentiel', 'Grossesse, depistage diabete gestationnel', 'demographie');
    }
  }
  if (demographics.cohort === 'femme_perimenopause' || demographics.cohort === 'femme_menopausee') {
    add('25-OH Vit D', 'recommande', 'Peri/menopause, prevention osteoporose', 'demographie');
    add('Bilan lipidique complet', 'recommande', 'Menopause, modification profil lipidique', 'demographie');
    add('TSH', 'recommande', 'Symptomes menopause/thyroide intriques', 'demographie');
  }
  if (demographics.cohort === 'homme_50_plus' || demographics.cohort === 'homme_senior') {
    add('Bilan lipidique complet', 'recommande', 'Homme >50 ans, depistage CV', 'demographie');
    add('Glycemie a jeun', 'recommande', 'Depistage diabete tardif', 'demographie');
    add('PSA', 'optionnel', 'Depistage prostate >50 ans', 'demographie');
  }
  if (demographics.imcCategory && /obesite/.test(demographics.imcCategory)) {
    add('Glycemie a jeun', 'essentiel', `IMC ${demographics.imc} (${demographics.imcCategory.replace('_', ' ')})`, 'demographie');
    add('Insuline a jeun + HOMA-IR', 'recommande', 'Obesite, evaluation resistance insulinique', 'demographie');
    add('Bilan hepatique (ASAT/ALAT/GGT)', 'recommande', 'Obesite, depistage steatose', 'demographie');
  }

  // ── LIFESTYLE / SYMPTOMES ──
  if (lifestyle.stressEleve || lifestyle.stressMaximal) {
    add('Cortisol matin', 'recommande', `Stress ${lifestyle.stress}/10, axe HPA`, 'lifestyle');
  }
  if (lifestyle.sommeilTresCourt) {
    if (!addedKeys.has('cortisol matin')) {
      add('Cortisol matin', 'recommande', `Sommeil ${lifestyle.heuresSommeil}h, axe HPA`, 'lifestyle');
    }
  }
  if (lifestyle.tabacActif) {
    add('CRP ultrasensible', 'recommande', 'Tabagisme actif, inflammation chronique', 'lifestyle');
    add('Bilan lipidique complet', 'recommande', 'Tabagisme actif, risque CV', 'lifestyle');
  }
  if (lifestyle.alcoolFrequent) {
    add('Bilan hepatique (ASAT/ALAT/GGT)', 'essentiel', 'Consommation alcool frequente, fonction hepatique', 'lifestyle');
    add('VGM + plaquettes', 'recommande', 'Alcool frequent, NFS', 'lifestyle');
  }
  if (symptoms.includes('fatigue') && !addedKeys.has('ferritine + bilan martial')) {
    add('Ferritine + bilan martial', 'essentiel', 'Fatigue declaree, statut fer prioritaire', 'symptome');
    add('25-OH Vit D', 'recommande', 'Fatigue, statut Vit D', 'symptome');
    add('TSH', 'recommande', 'Fatigue, fonction thyroidienne', 'symptome');
    add('B12 + folates', 'recommande', 'Fatigue, vitamines B', 'symptome');
  }
  if (symptoms.includes('skin_hair') && !addedKeys.has('25-oh vit d')) {
    add('Zinc serique', 'recommande', 'Troubles peau/cheveux, statut zinc', 'symptome');
    add('25-OH Vit D', 'recommande', 'Troubles peau, lien avec Vit D', 'symptome');
  }
  if (symptoms.includes('inflammation') && !addedKeys.has('crp ultrasensible')) {
    add('CRP ultrasensible', 'recommande', 'Inflammation declaree', 'symptome');
  }
  if (symptoms.includes('pms_cycle') && !addedKeys.has('ferritine + bilan martial')) {
    add('Ferritine + bilan martial', 'recommande', 'SPM/regles abondantes, statut fer', 'symptome');
  }

  // Tri par priorite
  const order = { essentiel: 0, recommande: 1, optionnel: 2 };
  tests.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));

  return tests;
}

// ─── RED FLAGS ─────────────────────────────────────────────────────

function buildRedFlags(ctx) {
  const flags = [];
  const { pathologies, lifestyle, demographics, traitements } = ctx;

  if (pathologies.diabete_t1.active && !pathologies.diabete_t1.complications.nephropathie) {
    flags.push({
      label: 'Diabete T1 - microalbuminurie OBLIGATOIRE annuelle',
      severity: 'critical',
    });
  }
  if (pathologies.diabete_t1.active) {
    flags.push({
      label: 'Diabete T1 - fond d\u2019oeil OBLIGATOIRE annuel (retinopathie)',
      severity: 'critical',
    });
  }
  if (traitements.avk.active) {
    flags.push({
      label: 'AVK - INR mensuel OBLIGATOIRE, attention Vit K2 et Omega-3 forte dose',
      severity: 'critical',
    });
  }
  if (traitements.lithium.active) {
    flags.push({
      label: 'Lithium - lithemie + creatinine + TSH reguliers',
      severity: 'critical',
    });
  }
  if (lifestyle.alcoolFrequent && demographics.age >= 40) {
    flags.push({
      label: 'Alcool frequent + age >= 40 - bilan hepatique imperatif',
      severity: 'high',
    });
  }
  if (demographics.cohort === 'femme_enceinte') {
    flags.push({
      label: 'Grossesse en cours - tout supplement / changement nutritionnel a valider par medecin/sage-femme',
      severity: 'critical',
    });
  }

  return flags;
}

// ─── ENTRY POINT ───────────────────────────────────────────────────

/**
 * Analyse exhaustive du formulaire client.
 * @param {object} form - Formulaire client (anamnese complete)
 * @returns {object} Contexte structure pour generation tests + recommandations
 */
export function analyzeAnamnese(form = {}) {
  // V94.24 : null safety (les default params ne s appliquent pas si null explicit)
  if (!form || typeof form !== 'object') form = {};
  const pathologies = detectPathologies(form);
  const traitements = detectTreatments(form);
  const familyHistory = detectFamilyHistory(form);
  const demographics = detectDemographics(form);
  const lifestyle = detectLifestyle(form);
  const symptoms = detectSymptomsExtended(form, demographics);

  const ctx = { pathologies, traitements, familyHistory, demographics, lifestyle, symptoms };
  const suggestedTests = buildSuggestedTests(ctx);
  const redFlags = buildRedFlags(ctx);

  return { ...ctx, suggestedTests, redFlags };
}

/**
 * Formate l'analyse pour injection dans un prompt IA.
 * Genere un bloc texte structure que l'IA peut utiliser directement.
 */
export function formatAnamneseForPrompt(analysis) {
  const lines = [];
  lines.push('=== CONTEXTES DETECTES (ANAMNESE) ===');

  // Pathologies actives
  const activePaths = Object.entries(analysis.pathologies)
    .filter(([, v]) => v.active)
    .map(([k]) => k.replace(/_/g, ' '));
  if (activePaths.length) {
    lines.push(`Pathologies actives : ${activePaths.join(', ')}`);
    if (analysis.pathologies.diabete_t1.active && analysis.pathologies.diabete_t1.complications.retinopathie) {
      lines.push('  - Complication : retinopathie active');
    }
    if (analysis.pathologies.diabete_t1.active && analysis.pathologies.diabete_t1.complications.nephropathie) {
      lines.push('  - Complication : nephropathie active');
    }
  }

  // Traitements
  const activeTraits = Object.entries(analysis.traitements)
    .filter(([, v]) => v.active)
    .map(([k]) => k);
  if (activeTraits.length) {
    lines.push(`Traitements en cours : ${activeTraits.join(', ')}`);
    for (const k of activeTraits) {
      const t = analysis.traitements[k];
      if (t.tests?.length) lines.push(`  - ${k} -> tests : ${t.tests.join(', ')}`);
      if (t.interactions?.length) lines.push(`  - ${k} -> interactions : ${t.interactions.join(', ')}`);
    }
  }

  // Antecedents familiaux
  const fams = Object.entries(analysis.familyHistory).filter(([, v]) => v).map(([k]) => k);
  if (fams.length) lines.push(`Antecedents familiaux : ${fams.join(', ')}`);

  // Demographie
  const d = analysis.demographics;
  lines.push(`Demographie : ${d.genre || '?'}, ${d.age || '?'} ans, IMC ${d.imc || '?'} (${d.imcCategory || '?'}), cohorte ${d.cohort}`);
  if (d.grossesseEnCours) lines.push('  - Grossesse en cours');
  if (d.grossesseProjet) lines.push('  - Projet de grossesse');
  if (d.menopause) lines.push('  - Menopausee');
  if (d.perimenopause) lines.push('  - Perimenopause');

  // Lifestyle critique
  const ls = analysis.lifestyle;
  const lsFlags = [];
  if (ls.tabacActif) lsFlags.push('tabac actif');
  if (ls.alcoolFrequent) lsFlags.push('alcool frequent');
  if (ls.alcoolModere) lsFlags.push('alcool modere');
  if (ls.sedentaire) lsFlags.push('sedentaire');
  if (ls.sportIntensif) lsFlags.push('sport intensif');
  if (ls.sommeilTresCourt) lsFlags.push(`sommeil ${ls.heuresSommeil}h (court)`);
  if (ls.stressMaximal) lsFlags.push(`stress ${ls.stress}/10 (maximal)`);
  else if (ls.stressEleve) lsFlags.push(`stress ${ls.stress}/10 (eleve)`);
  if (ls.hydratationBasse) lsFlags.push(`hydratation ${ls.hydratationLitres}L (basse)`);
  if (ls.tourTailleHaut) lsFlags.push(`tour de taille ${ls.tourTaille}cm (eleve)`);
  if (lsFlags.length) lines.push(`Lifestyle : ${lsFlags.join(', ')}`);

  // Symptomes
  if (analysis.symptoms.length) lines.push(`Symptomes detectes : ${analysis.symptoms.join(', ')}`);

  // RED FLAGS
  if (analysis.redFlags.length) {
    lines.push('');
    lines.push('!! RED FLAGS (a mentionner imperativement) :');
    for (const f of analysis.redFlags) {
      lines.push(`  - [${f.severity.toUpperCase()}] ${f.label}`);
    }
  }

  // TESTS SUGGERES (pre-calcules pour guider l'IA)
  if (analysis.suggestedTests.length) {
    lines.push('');
    lines.push('=== TESTS PRE-CALCULES (selectionne et justifie selon le profil reel) ===');
    for (const t of analysis.suggestedTests) {
      lines.push(`[${t.priority.toUpperCase()}] ${t.test} <- ${t.reason} (source: ${t.source})`);
    }
    lines.push('');
    lines.push('Regle : utilise ces suggestions comme base. Choisis 4-6 tests pertinents,');
    lines.push('formule chaque "justification" en liant explicitement au PROFIL REEL du patient');
    lines.push('(taux deja mesure, age, pathologie active, traitement, antecedent familial precis).');
  }

  return lines.join('\n');
}
