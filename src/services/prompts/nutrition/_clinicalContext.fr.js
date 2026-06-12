// V97.4 — Couche clinicalContext (Phase V1).
// Date : 2026-05-12
//
// Rôle : transformer un objet `clinicalContext` structuré en bloc texte
// brut injectable dans le system prompt nutrition. Pendant naturel de
// _detector.fr.js (qui répond "qui est la cliente" depuis l'anamnèse),
// cette couche répond "ce qu'on a mesuré" depuis les tests + résultats +
// signaux + phase microbiome.
//
// Séparation des préoccupations :
//   _detector.fr.js       → form        → profils cliente (tags)
//   _clinicalContext.fr.js → clinicalContext → bloc clinique structuré
//
// V1 : prépare seulement l'API d'injection. La construction du clinicalContext
// depuis le SaaS (JourneyPlanEditor + analyses prescrites + résultats saisis)
// viendra en V2.
//
// Garanties :
// - Ne throw JAMAIS pour un clinicalContext partiel / null / undefined.
// - Retourne '' (empty string) si rien à injecter.
// - Tolère plusieurs conventions de noms (test.name OU test.display_name, etc.)
//   pour compatibilité avec différentes sources (catalogue Ortho/MGD, résultats
//   saisis manuellement, etc.).

import { resolveMaternalState } from './profiles/_detector.fr.js';

/**
 * Détermine si un clinicalContext est vide (rien à injecter).
 * @param {object | null | undefined} ctx
 * @returns {boolean}
 */
export function isEmptyClinicalContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return true;
  const hasTests = Array.isArray(ctx.selectedTests) && ctx.selectedTests.length > 0;
  const hasMarkers = Array.isArray(ctx.expectedMarkers) && ctx.expectedMarkers.length > 0;
  const hasResults = Array.isArray(ctx.enteredResults) && ctx.enteredResults.length > 0;
  const hasSignals = Array.isArray(ctx.clinicalSignals) && ctx.clinicalSignals.length > 0;
  const hasStage = ctx.microbiomeStage && typeof ctx.microbiomeStage === 'object';
  const hasModules = Array.isArray(ctx.promptModules) && ctx.promptModules.length > 0;
  const hasSafety = Array.isArray(ctx.safetyRules) && ctx.safetyRules.length > 0;
  return !(hasTests || hasMarkers || hasResults || hasSignals || hasStage || hasModules || hasSafety);
}

// ─── BLOC SÉCURITÉ CLINIQUE (P0.1 + P0.2, remède 2026-06-10) ────────

/**
 * Contraintes maternelles préventives, par état résolu (P0 Module 1, 2026-06-12).
 *
 * Contenu clinique validé Anissa — Module 1. Formulation des phrases injectées
 * à relire par Anissa.
 *
 * Donnée déclarative isolée (pattern clinicalInteractions) : éditable, et
 * destinée à migrer plus tard vers le registre Supabase. Injectée sur le chemin
 * TOUJOURS ACTIF (buildSafetyBlockFr), pas via le composer OPT-IN.
 *
 * Post-partum : état DÉTECTÉ par resolveMaternalState mais SANS bloc en V1 —
 * contraintes non encore définies. GAP CLINIQUE à compléter par Anissa.
 */
const MATERNAL_SAFETY_FR = {
  grossesse: {
    label: 'GROSSESSE en cours',
    rules: [
      'Pas de jeûne (ni intermittent ni prolongé).',
      'Pas de restriction calorique agressive.',
      "Vigilance vitamine A (éviter les apports/compléments à forte dose et les sources concentrées comme le foie).",
      "Vigilance iode (besoins spécifiques — ne pas sur- ni sous-doser sans avis de la praticienne).",
    ],
  },
  allaitement: {
    label: 'ALLAITEMENT en cours',
    rules: [
      'Pas de restriction calorique agressive.',
      "Vigilance supplémentation (toute supplémentation à valider avec la praticienne).",
    ],
  },
  // postPartum : volontairement absent en V1 (gap clinique documenté ci-dessus).
};

/**
 * Construit le bloc « SÉCURITÉ CLINIQUE » injecté dans le system prompt de
 * génération de plan. SOURCE UNIQUE des données de sécurité (allergènes,
 * intolérances, traitements/médicaments).
 *
 * Dérivé directement de `form` — et non de `clinicalContext` — parce que les
 * trois builders de prompt (composer / classique `buildSystemPromptFr` / legacy
 * `NutritionConsultation`) reçoivent tous `form`, mais un seul consomme
 * `clinicalContext`. En dérivant de form et en appelant cette fonction depuis
 * chaque builder, on garantit la présence du bloc sur TOUS les chemins
 * (cf. correction d'architecture du remède, 2026-06-10).
 *
 * Additif strict : n'enlève aucun canal user-message existant (le retrait des
 * doublons est P1, fait une fois ce canal prouvé sur les trois chemins).
 * Fail-safe : retourne '' si aucune donnée de sécurité (ne throw jamais).
 *
 * @param {object|null|undefined} form - anamnèse cliente
 * @returns {string} bloc texte prêt à concaténer, ou '' si rien.
 */
export function buildSafetyBlockFr(form) {
  if (!form || typeof form !== 'object') return '';
  const allergies = String(form.allergies ?? '').trim();
  const intolerances = String(form.alimentsEvites ?? '').trim();
  // `||` (et non `??`) pour que l'alias medicaments prenne le relais quand
  // traitements est une chaîne vide (et pas seulement null/undefined).
  const medications = String(form.traitements || form.medicaments || '').trim();

  // P0 maternel (Module 1) — calculé AVANT la garde précoce : une cliente
  // enceinte/allaitante SANS allergie ni médicament doit quand même recevoir
  // ses contraintes. Source = resolveMaternalState (lit le format in-app
  // combiné ET le legacy séparé), pas les seuls champs legacy.
  const maternal = resolveMaternalState(form);
  const maternalRules = MATERNAL_SAFETY_FR[maternal] || null;

  if (!allergies && !intolerances && !medications && !maternalRules) return '';

  const lines = [
    'SÉCURITÉ CLINIQUE — CONTRAINTES ABSOLUES (priorité sur toute autre consigne de ce prompt) :',
  ];
  if (maternalRules) {
    lines.push(`- ${maternalRules.label} — CONTRAINTES ABSOLUES : ${maternalRules.rules.join(' ')}`);
  }
  if (allergies) {
    // Micro-correctif P0.1 (2026-06-10) : la traduction EN (P0.5) a révélé que
    // le titre FR portait moins de force que le corps — « À EXCLURE
    // STRICTEMENT » n'apparaissait que dans la consigne, pas dans l'intitulé.
    // Aligné sur l'EN (« STRICTLY EXCLUDE ») pour que l'injonction soit lisible
    // dès le titre de ligne.
    lines.push(`- ALLERGÈNES déclarés — À EXCLURE STRICTEMENT : ${allergies}. N'inclure AUCUN de ces aliments — ni dérivé, ni trace — dans aucun menu, recette, liste de courses ou suggestion de complément.`);
  }
  if (intolerances) {
    lines.push(`- Intolérances / aliments à éviter : ${intolerances}. Exclure de toutes les propositions.`);
  }
  if (medications) {
    lines.push(`- Traitements / médicaments en cours : ${medications}. Tenir compte des interactions aliment-/complément-médicament connues (ex. millepertuis ↔ antidépresseurs, vitamine K ↔ anticoagulants, pamplemousse ↔ statines). Ne jamais suggérer d'arrêter, de modifier ni de remplacer un traitement ; en cas d'interaction possible, le signaler à la praticienne plutôt que d'agir dessus.`);
  }
  return lines.join('\n');
}

// ─── Helpers de formatting (tolérants aux conventions de noms) ──────

/**
 * Sélectionne la première valeur non-vide parmi plusieurs clés candidates.
 * Renvoie '' si aucune valeur trouvée.
 */
function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

/**
 * Formate un test sélectionné : "Nom — laboratoire — catégorie — prix CHF".
 * Tolère : test.name | test.display_name, test.lab | test.source_lab,
 * test.category, test.price_chf | test.cost_anissa_chf.
 */
export function formatTest(test) {
  if (!test || typeof test !== 'object') return '';
  const name = pick(test, 'name', 'display_name');
  if (!name) return '';
  const lab = pick(test, 'lab', 'source_lab');
  const category = pick(test, 'category');
  const price = pick(test, 'price_chf', 'cost_anissa_chf');
  const parts = [name];
  if (lab) parts.push(String(lab));
  if (category) parts.push(String(category));
  if (price !== '' && price !== null && !Number.isNaN(Number(price))) {
    parts.push(`${price} CHF`);
  }
  return `- ${parts.join(' — ')}`;
}

/**
 * Formate un marqueur attendu : "Nom — unité — axe clinique".
 * Tolère : marker.label | marker.name, marker.unit, marker.clinical_axis | marker.axis.
 */
export function formatMarker(marker) {
  if (!marker || typeof marker !== 'object') return '';
  const label = pick(marker, 'label', 'name');
  if (!label) return '';
  const unit = pick(marker, 'unit');
  const axis = pick(marker, 'clinical_axis', 'axis');
  const parts = [label];
  if (unit) parts.push(String(unit));
  if (axis) parts.push(String(axis));
  return `- ${parts.join(' — ')}`;
}

/**
 * Formate un résultat saisi : "Marqueur : valeur unité — note Anissa".
 * Tolère : result.label | result.marker_label | result.test_name,
 * result.value, result.unit, result.synthesis | result.note_anissa.
 */
export function formatResult(result) {
  if (!result || typeof result !== 'object') return '';
  const label = pick(result, 'label', 'marker_label', 'test_name');
  const value = pick(result, 'value');
  if (!label || value === '') return '';
  const unit = pick(result, 'unit');
  const note = pick(result, 'synthesis', 'note_anissa');
  const valueWithUnit = unit ? `${value} ${unit}` : `${value}`;
  let line = `- ${label} : ${valueWithUnit}`;
  if (note) line += ` — ${note}`;
  return line;
}

/**
 * Formate un signal clinique : "Label — priorité X — confiance Y — source: a, b".
 * Tolère : signal.label | signal.id, signal.priority | signal.priority_score,
 * signal.confidence, signal.source_markers (array).
 */
export function formatSignal(signal) {
  if (!signal || typeof signal !== 'object') return '';
  const label = pick(signal, 'label', 'id');
  if (!label) return '';
  const priority = pick(signal, 'priority', 'priority_score');
  const confidence = pick(signal, 'confidence');
  const sources = Array.isArray(signal.source_markers) ? signal.source_markers.filter(Boolean) : [];
  const parts = [label];
  if (priority !== '') parts.push(`priorité ${priority}`);
  if (confidence) parts.push(`confiance ${confidence}`);
  if (sources.length > 0) parts.push(`source : ${sources.join(', ')}`);
  return `- ${parts.join(' — ')}`;
}

/**
 * Formate la phase microbiome active en bloc multi-ligne.
 * Renvoie '' si stage absent ou sans label/id.
 *
 * V3.F — wording prudent : "Phase probable" plutôt que "Phase".
 * Affiche confidence + reasons + override quand fournis (champs V3.F),
 * rétro-compat avec callers qui passent seulement label/goal (V1).
 */
export function formatMicrobiomeStage(stage) {
  if (!stage || typeof stage !== 'object') return '';
  const label = pick(stage, 'label', 'name');
  const id = pick(stage, 'id');

  // V3.F : si pas de phase tranchée mais des raisons audit présentes,
  // on émet quand même un bloc "Pas de phase tranchée — pistes" pour
  // que l'IA voit l'analyse partielle (transparent).
  const reasons = Array.isArray(stage.reasons) ? stage.reasons.filter(Boolean) : [];
  if (!label && !id) {
    if (reasons.length === 0) return '';
    const lines = ['- Phase microbiome : non tranchée (vigilance, pistes partielles)'];
    lines.push(`- Indices observés : ${reasons.join(' ; ')}`);
    return lines.join('\n');
  }

  const overridden = stage.overridden_by_practitioner === true;
  const confidence = pick(stage, 'confidence');
  const lines = [];

  // V3.F : wording suggestif, jamais prescriptif.
  if (overridden) {
    lines.push(`- Phase retenue par la praticienne : ${label || id}`);
    const overrideReason = pick(stage, 'override_reason');
    if (overrideReason) lines.push(`- Motif praticienne : ${overrideReason}`);
  } else {
    const cf = confidence ? ` (confiance ${confidence})` : '';
    lines.push(`- Phase probable : ${label || id}${cf}`);
  }

  const goal = pick(stage, 'goal', 'objective');
  if (goal) lines.push(`- Objectif : ${goal}`);

  if (reasons.length > 0) {
    lines.push(`- Raisons : ${reasons.join(' ; ')}`);
  }

  const targetMarkers = Array.isArray(stage.target_markers) ? stage.target_markers.filter(Boolean) : [];
  if (targetMarkers.length > 0) {
    lines.push(`- Marqueurs à surveiller : ${targetMarkers.join(', ')}`);
  }

  const allowed = Array.isArray(stage.allowed_interventions) ? stage.allowed_interventions.filter(Boolean) : [];
  if (allowed.length > 0) lines.push(`- Autorisé : ${allowed.join(', ')}`);

  const blocked = Array.isArray(stage.blocked_interventions) ? stage.blocked_interventions.filter(Boolean) : [];
  if (blocked.length > 0) lines.push(`- À éviter : ${blocked.join(', ')}`);

  return lines.join('\n');
}

// ─── Builder principal ──────────────────────────────────────────────

/**
 * Construit le bloc clinique structuré injecté dans le system prompt.
 *
 * @param {object | null | undefined} clinicalContext
 * @returns {string} Texte brut prêt à concaténer dans le prompt, ou '' si vide.
 */
export function buildClinicalContextBlockFr(clinicalContext) {
  // Garde-fou principal : ne throw jamais, retourne '' si rien à injecter.
  if (isEmptyClinicalContext(clinicalContext)) return '';

  const ctx = clinicalContext;
  const blocks = [];

  // ─── ANALYSES SÉLECTIONNÉES ─────────────────────────────────────
  const selectedTests = Array.isArray(ctx.selectedTests) ? ctx.selectedTests : [];
  const testLines = selectedTests.map(formatTest).filter(Boolean);
  if (testLines.length > 0) {
    blocks.push(`ANALYSES SÉLECTIONNÉES :\n${testLines.join('\n')}`);
  }

  // ─── MARQUEURS ATTENDUS ─────────────────────────────────────────
  const expectedMarkers = Array.isArray(ctx.expectedMarkers) ? ctx.expectedMarkers : [];
  const markerLines = expectedMarkers.map(formatMarker).filter(Boolean);
  if (markerLines.length > 0) {
    blocks.push(`MARQUEURS ATTENDUS :\n${markerLines.join('\n')}`);
  }

  // ─── RÉSULTATS DISPONIBLES ──────────────────────────────────────
  // Garde-fou : si selectedTests vide mais enteredResults présent, préciser
  // qu'il s'agit d'analyses externes ou non reliées à un plan.
  const enteredResults = Array.isArray(ctx.enteredResults) ? ctx.enteredResults : [];
  const resultLines = enteredResults.map(formatResult).filter(Boolean);
  if (resultLines.length > 0) {
    const header = (selectedTests.length === 0)
      ? 'RÉSULTATS DISPONIBLES (analyses externes ou non reliées à un plan) :'
      : 'RÉSULTATS DISPONIBLES :';
    blocks.push(`${header}\n${resultLines.join('\n')}`);
  }

  // ─── SIGNAUX CLINIQUES PRIORITAIRES ─────────────────────────────
  const clinicalSignals = Array.isArray(ctx.clinicalSignals) ? ctx.clinicalSignals : [];
  const signalLines = clinicalSignals.map(formatSignal).filter(Boolean);
  if (signalLines.length > 0) {
    blocks.push(`SIGNAUX CLINIQUES PRIORITAIRES :\n${signalLines.join('\n')}`);
  }

  // ─── PHASE MICROBIOME ACTIVE ────────────────────────────────────
  const stageBlock = formatMicrobiomeStage(ctx.microbiomeStage);
  if (stageBlock) {
    blocks.push(`PHASE MICROBIOME ACTIVE :\n${stageBlock}`);
  }

  // ─── MODULES IA SPÉCIFIQUES (optionnel V1, prévu pour V2+) ─────
  const promptModules = Array.isArray(ctx.promptModules) ? ctx.promptModules.filter(Boolean) : [];
  if (promptModules.length > 0) {
    blocks.push(`MODULES CLINIQUES MOBILISÉS :\n${promptModules.map((m) => `- ${m}`).join('\n')}`);
  }

  // ─── RÈGLES SAFETY SUPPLÉMENTAIRES (optionnel V1) ──────────────
  const safetyRules = Array.isArray(ctx.safetyRules) ? ctx.safetyRules.filter(Boolean) : [];
  if (safetyRules.length > 0) {
    blocks.push(`RÈGLES DE SÉCURITÉ SPÉCIFIQUES :\n${safetyRules.map((r) => `- ${r}`).join('\n')}`);
  }

  // Garde-fou : si tout filtre laisse blocks vide après l'isEmptyClinicalContext
  // (entrées présentes mais toutes mal formées), on n'injecte rien.
  if (blocks.length === 0) return '';

  // ─── RÈGLES D'INTERPRÉTATION (toujours injectées si bloc non vide) ──
  const interpretationRules = `RÈGLES D'INTERPRÉTATION :
- Ne jamais interpréter une analyse non réalisée.
- Ne jamais conclure sur un marqueur absent.
- Ne pas poser de diagnostic.
- Utiliser les résultats comme éléments d'orientation nutritionnelle.
- Limiter la synthèse à 3 priorités principales.
- Si les résultats sont incomplets, le préciser clairement.`;

  return `CONTEXTE CLINIQUE STRUCTURÉ :

${blocks.join('\n\n')}

${interpretationRules}`;
}
