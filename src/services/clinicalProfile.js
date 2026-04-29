// V94.27 : extrait depuis NutritionConsultation.jsx (Phase 1.B refactor)
// Helpers d'analyse clinique :
// - detectSymptomsFromForm : extrait les symptomes du formulaire
// - buildPreRdvSummary : synthese client pre-RDV
// - buildLabSectionForPlan : ajustements nutritionnels selon bilans bio
// - buildClinicalSummary : synthese interne pour orientation IA
// - suggestStatus : suggestion de statut pipeline client
// - formatDate : format DD/MM/YYYY
// - buildRecommendedBloodTests : tests biologiques suggeres (delegate a anamneseAnalyzer)

import { analyzeLabResults } from '../labInterpretationEngine';
import { analyzeAnamnese } from './anamneseAnalyzer';

/** Format date ISO -> DD/MM/YYYY (locale fr-CH) */
export function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Detecte les symptomes du formulaire client (energie, digestion, stress, etc.)
 * @returns {string[]} liste deduplicee de tags symptomes
 */
export function detectSymptomsFromForm(form) {
  const symptoms = [];
  const f = form || {};

  // Energy (scale 1-5, low = symptom)
  if (f.energieJournee && Number(f.energieJournee) <= 2) symptoms.push('fatigue');

  // Digestion (scale 1-5 or text)
  if (f.frequenceBallonnements && Number(f.frequenceBallonnements) <= 2) symptoms.push('digestion', 'bloating');
  else if (f.frequenceBallonnements && Number(f.frequenceBallonnements) <= 3) symptoms.push('digestion');

  // Stress (scale 1-10, high = high stress)
  if (f.niveauStressActuel && Number(f.niveauStressActuel) >= 7) symptoms.push('stress');

  // Sleep (actual hours)
  if (f.heuresSommeil && Number(f.heuresSommeil) <= 5) symptoms.push('sleep');
  if (f.difficultesEndormissement && /oui|souvent|regulier/i.test(f.difficultesEndormissement)) symptoms.push('sleep');

  // Cravings
  if (f.fringalesSucre && /oui|souvent|regulier|fort/i.test(f.fringalesSucre)) symptoms.push('cravings');

  // Inflammation
  if (f.douleursInflammations && f.douleursInflammations.trim()) symptoms.push('inflammation');

  // Skin/hair
  if (f.troublesPeau && f.troublesPeau.trim()) symptoms.push('skin_hair');

  // Objectives → symptoms
  const obj = (f.objectifPrincipalNutrition || '').toLowerCase();
  if (/poids|perte/.test(obj)) symptoms.push('weight_gain', 'metabolic');
  if (/hormone/.test(obj)) symptoms.push('female_hormones');
  if (/performance/.test(obj)) symptoms.push('performance');
  if (/digestion/.test(obj) && !symptoms.includes('digestion')) symptoms.push('digestion');
  if (/energie|fatigue/.test(obj) && !symptoms.includes('fatigue')) symptoms.push('fatigue');

  // SPM / cycle
  if (f.spm && /oui|fort|regulier/i.test(f.spm)) symptoms.push('pms_cycle');
  if (f.douleursMenstruelles && /oui|fort|regulier/i.test(f.douleursMenstruelles)) symptoms.push('pms_cycle');

  // Thyroid hints
  if (f.pathologies && /thyro[iï]d|hashimoto|levothyrox/i.test(f.pathologies)) symptoms.push('thyroid');

  return [...new Set(symptoms)];
}

/**
 * Synthese pre-RDV : objectif + 3 priorites + 3 vigilances + 3 axes + sport.
 * Utilise pour l'affichage UI et pour preparer Anissa avant la consultation.
 */
export function buildPreRdvSummary(form) {
  const f = form || {};
  const symptoms = detectSymptomsFromForm(f);

  // Objective
  const objectif = f.objectifPrincipalNutrition || f.objectifPrincipal || '';

  // Scoring: detect problematic fields and rank them
  const signals = [];

  // Energy (scale fields: 1-2 = problematic, 3 = borderline)
  const energie = Number(f.energieJournee);
  if (energie && energie <= 2) signals.push({ label: 'Energie basse', priority: 1 });
  else if (energie && energie <= 3) signals.push({ label: 'Energie moyenne', priority: 3 });

  // Digestion
  const ballonnements = Number(f.frequenceBallonnements);
  if (ballonnements && ballonnements <= 2) signals.push({ label: 'Digestion perturbee (ballonnements frequents)', priority: 1 });
  else if (ballonnements && ballonnements <= 3) signals.push({ label: 'Digestion fragile', priority: 2 });

  // Stress (1-10 scale, high = stressed)
  const stress = Number(f.niveauStressActuel);
  if (stress && stress >= 7) signals.push({ label: `Stress eleve (${stress}/10)`, priority: 1 });
  else if (stress && stress >= 5) signals.push({ label: `Stress modere (${stress}/10)`, priority: 3 });

  // Sleep
  const heures = Number(f.heuresSommeil);
  if (heures && heures <= 5) signals.push({ label: `Sommeil insuffisant (${heures}h)`, priority: 1 });
  else if (heures && heures <= 6) signals.push({ label: `Sommeil limite (${heures}h)`, priority: 2 });
  if (f.difficultesEndormissement && /oui|souvent|regulier/i.test(f.difficultesEndormissement)) {
    signals.push({ label: 'Difficultes d\'endormissement', priority: 2 });
  }

  // Cravings
  if (f.fringalesSucre && /oui|souvent|regulier|fort/i.test(f.fringalesSucre)) {
    signals.push({ label: 'Fringales sucrees', priority: 2 });
  }

  // Hydration
  if (f.hydratation && /faible|insuffisant|peu|<\s*1/i.test(f.hydratation)) {
    signals.push({ label: 'Hydratation faible', priority: 2 });
  }

  // Inflammation
  if (f.douleursInflammations && f.douleursInflammations.trim()) {
    signals.push({ label: 'Inflammation / douleurs', priority: 2 });
  }

  // Pathologies (always priority 1)
  if (f.pathologies && f.pathologies.trim()) {
    signals.push({ label: `Pathologie : ${f.pathologies.trim().slice(0, 50)}`, priority: 1 });
  }

  // Allergies
  if (f.allergies && f.allergies.trim() && !/aucune|non|rien/i.test(f.allergies)) {
    signals.push({ label: `Allergies : ${f.allergies.trim().slice(0, 50)}`, priority: 1 });
  }

  // Sort by priority (1 = highest)
  signals.sort((a, b) => a.priority - b.priority);

  // Build priorities (top 3 problematic signals)
  const priorities = signals.filter(s => s.priority <= 2).slice(0, 3).map(s => s.label);

  // Build vigilance points (lower priority items not in priorities)
  const vigilance = signals.filter(s => !priorities.includes(s.label)).slice(0, 3).map(s => s.label);

  // Build axes de travail (derived from priorities + symptoms)
  const axes = [];
  if (symptoms.includes('digestion') || symptoms.includes('bloating')) axes.push('Ameliorer le confort digestif');
  if (symptoms.includes('fatigue')) axes.push('Restaurer l\'energie');
  if (symptoms.includes('cravings')) axes.push('Stabiliser la glycemie et reduire les fringales');
  if (symptoms.includes('stress') || symptoms.includes('sleep')) axes.push('Soutenir l\'axe stress-sommeil');
  if (symptoms.includes('weight_gain') || symptoms.includes('metabolic')) axes.push('Favoriser la perte de gras');
  if (symptoms.includes('inflammation')) axes.push('Reduire l\'inflammation');
  if (symptoms.includes('pms_cycle') || symptoms.includes('female_hormones')) axes.push('Equilibrer le cycle hormonal');
  if (symptoms.includes('performance')) axes.push('Optimiser la performance sportive');

  // Sport context
  const sport = [f.typeSport, f.frequenceSport ? `${f.frequenceSport}x/sem` : ''].filter(Boolean).join(' ');

  return {
    objectif,
    priorities,
    vigilance,
    axes: axes.slice(0, 3),
    sport: sport || null,
    nbRepas: f.nbRepas || null,
    hydratation: f.hydratation || null,
    hasData: !!(objectif || priorities.length || axes.length),
  };
}

/**
 * Construit une section "ajustements bases sur bilans biologiques" pour injection
 * dans le prompt IA du plan nutrition. Retourne null si pas de bilans dispo.
 */
export function buildLabSectionForPlan(labResults) {
  if (!labResults || Object.keys(labResults).length === 0) return null;

  const analysis = analyzeLabResults(labResults);
  if (analysis.signals.length === 0) return null;

  const lines = ['', '--- ADAPTATIONS BASEES SUR LES RESULTATS BIOLOGIQUES ---', ''];

  // Markers summary: concerns first (max 3), then borderline (max 2)
  const concerns = analysis.summary.concerns.slice(0, 3);
  const borderline = analysis.summary.borderline.slice(0, 2);
  if (concerns.length > 0) {
    lines.push('Marqueurs a optimiser :');
    for (const c of concerns) {
      lines.push(`- ${c.label} : ${c.value} ${c.unit} (${c.status})`);
    }
  }
  if (borderline.length > 0) {
    lines.push('Marqueurs en zone limite :');
    for (const b of borderline) {
      lines.push(`- ${b.label} : ${b.value} ${b.unit} (${b.status})`);
    }
  }
  lines.push('');

  // Adjustments (max 5) with max 3 cautions
  const adjustments = analysis.adjustments.slice(0, 5);
  let cautionCount = 0;
  lines.push('Ajustements nutritionnels proposes :');
  for (const adj of adjustments) {
    lines.push(`\n${adj.label} :`);
    for (const d of adj.dietary.slice(0, 2)) {
      lines.push(`- ${d}`);
    }
    if (adj.supplement) {
      lines.push(`- Option : ${adj.supplement}`);
    }
    if (adj.caution && cautionCount < 3) {
      lines.push(`- A noter : ${adj.caution}`);
      cautionCount++;
    }
  }

  lines.push('');
  lines.push('Ces adaptations sont basees sur une lecture fonctionnelle et restent a individualiser.');

  return lines.join('\n');
}

/**
 * Synthese clinique interne pour orientation IA (priorites, symptomes, signaux bio,
 * strategie attendue). Utilisee comme contexte dans le prompt IA.
 */
export function buildClinicalSummary(form, { mgdSymptoms, labAnalysis, isFollowup, followupWeek } = {}) {
  const lines = ['--- SYNTHESE CLINIQUE INTERNE (orientation IA) ---', ''];
  const f = form || {};

  // Context
  if (isFollowup) {
    lines.push(`Contexte : consultation de suivi, semaine ${followupWeek || '?'}/4.`);
  } else {
    lines.push('Contexte : premiere consultation, construction du plan nutritionnel complet.');
  }

  // Objective
  const objectif = f.objectifPrincipalNutrition || f.objectifPrincipal || '';
  if (objectif) {
    lines.push(`Objectif principal : ${objectif}.`);
  }

  // Clinical priority
  const priorities = [];
  if (f.pathologies && f.pathologies.trim()) priorities.push('pathologie (' + f.pathologies.trim().slice(0, 60) + ')');
  const symptoms = mgdSymptoms || [];
  if (symptoms.includes('digestion') || symptoms.includes('bloating')) priorities.push('digestion');
  if (symptoms.includes('fatigue')) priorities.push('energie');
  if (symptoms.includes('cravings')) priorities.push('comportement alimentaire');
  if (symptoms.includes('stress') || symptoms.includes('sleep')) priorities.push('axe stress/sommeil');
  if (priorities.length > 0) {
    lines.push(`Priorite clinique : ${priorities.slice(0, 3).join(' > ')}.`);
  }

  // Dominant symptoms (max 5)
  if (symptoms.length > 0) {
    lines.push(`Symptomes dominants : ${symptoms.slice(0, 5).map(s => s.replace(/_/g, ' ')).join(', ')}.`);
  }

  // Lab signals (max 3)
  if (labAnalysis && labAnalysis.signals && labAnalysis.signals.length > 0) {
    const labSignals = labAnalysis.adjustments.slice(0, 3).map(a => a.label);
    lines.push(`Signaux biologiques : ${labSignals.join(', ')}.`);
  }

  // Expected strategy (max 4)
  lines.push('');
  lines.push('Strategie nutritionnelle attendue :');
  if (isFollowup) {
    lines.push('- Ajustements progressifs bases sur le feedback client');
    if (symptoms.includes('digestion')) lines.push('- Simplifier si digestion instable');
    if (labAnalysis?.signals?.length > 0) lines.push('- Integrer les adaptations biologiques');
    lines.push('- Ne pas reecrire le plan complet, ajuster');
  } else {
    lines.push('- Plan structure et applicable');
    if (f.allergies && f.allergies.trim()) lines.push('- Exclure strictement : ' + f.allergies.trim().slice(0, 80));
    if (symptoms.includes('digestion')) lines.push('- Privilegier aliments neutres et digestibles');
    if (symptoms.includes('fatigue') || (labAnalysis?.signals || []).includes('low_iron_status')) lines.push('- Optimiser apports en fer, B12, vitamine D');
    if (symptoms.includes('cravings') || (labAnalysis?.signals || []).includes('glycemic_dysregulation')) lines.push('- Stabiliser la glycemie (IG bas, fibres, proteines)');
    if (f.frequenceSport && f.frequenceSport !== 'Jamais') lines.push('- Adapter selon activite physique');
  }

  return lines.join('\n');
}

/**
 * Suggere un statut pipeline pour la consultation.
 * @returns {string|null} - 'a_valider', 'attente_analyses', 'dossier_complet', ou null
 */
export function suggestStatus(consultation) {
  const c = consultation || {};
  if (c.nutrition_plan && c.nutrition_plan.trim()) return 'a_valider';
  if ((c.mgd_recommendation === 'blood' || c.mgd_recommendation === 'advanced') && (!c.lab_results || Object.values(c.lab_results || {}).every(v => !v))) return 'attente_analyses';
  if (c.lab_results && Object.values(c.lab_results || {}).some(v => v)) return 'dossier_complet';
  return null;
}

/**
 * V94.18 : remplace l ancienne logique par l Anamnese Analyzer Premium qui scrute
 * pathologies + traitements + antecedents familiaux + demographie + lifestyle + symptomes.
 * Garde le SAME interface (string newline-separated) pour compat avec le textarea
 * "Analyses recommandees (MGD)", mais format enrichi : "Test : justification".
 */
export function buildRecommendedBloodTests(form) {
  try {
    const analysis = analyzeAnamnese(form || {});
    if (!analysis.suggestedTests.length) {
      // Fallback minimal si analyzer ne detecte rien
      return [
        'Vitamine D 25-OH : statut general',
        'Ferritine + bilan martial : statut fer',
        'TSH : fonction thyroidienne',
        'CRP ultrasensible : inflammation chronique',
      ].join('\n');
    }

    // On garde uniquement [essentiel] et [recommande], skip [optionnel] (le medecin valide)
    const filtered = analysis.suggestedTests
      .filter(t => t.priority !== 'optionnel')
      .slice(0, 8);

    return filtered.map(t => `${t.test} : ${t.reason}`).join('\n');
  } catch {
    return 'Vitamine D 25-OH\nFerritine\nTSH\nCRP ultrasensible';
  }
}
