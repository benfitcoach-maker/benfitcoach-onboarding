// ─── clinicalInteractions.js ────────────────────────────────────────────
// P1.2 (remède sécurité clinique, 2026-06-10) — classification des
// interactions complément↔traitement pour la clairance clinique.
//
// ⚠️ PROPOSITION CONSERVATRICE — À VALIDER CLINIQUEMENT PAR ANISSA. ⚠️
//
// Décider qu'une substance BLOQUE un plan (contre-indication) plutôt qu'elle
// soit simplement « à espacer » (advisory) est un jugement de professionnel
// de santé. Benoit (coach) et l'IA n'ont pas l'autorité clinique pour trancher.
// Cette liste est donc une DONNÉE révisable, pas du code de décision : Anissa
// la relit et l'amende (substance par substance, avec sa raison).
//
// Tant qu'Anissa n'a pas tranché, le système fonctionne avec cette proposition
// par défaut. Promotion possible vers une table Supabase studio-éditable (même
// pattern que `clinical_guardrails`) le jour où elle veut la gérer elle-même.
//
// FAIL-CLOSED CLINIQUE : toute substance NON listée ici retombe en
// `needs_review` (signalée pour revue), jamais en `advisory` silencieux. Dans
// le doute, on sur-signale — Anissa déclasse une fausse alerte plus facilement
// qu'elle ne rattrape une interaction passée sous silence.
//
// La donnée source des interactions par traitement vit dans
// anamneseAnalyzer.detectTreatments (champ `interactions`). Ce module ne fait
// que CLASSER ces substances ; il n'invente aucune interaction.

/**
 * Classification par substance. Les clés sont des fragments normalisés
 * (minuscule, sans accent) recherchés en sous-chaîne dans l'intitulé brut de
 * l'interaction. `classification` : 'blocking' | 'advisory'.
 * Tout ce qui n'est pas listé → 'needs_review' (cf. classifyInteraction).
 */
export const INTERACTION_CLASSIFICATION = {
  // — BLOQUANT (proposition à valider) : plantes / compléments forte dose
  //   qu'un plan ne devrait pas recommander en présence du traitement —
  'millepertuis': { classification: 'blocking', reason: 'Inducteur enzymatique (CYP3A4/P-gp) — réduit l\'efficacité de nombreux traitements (antidépresseurs, pilule, AVK, statines).' },
  'vitamine k2': { classification: 'blocking', reason: 'Antagonise les AVK (vitamine K).' },
  'omega-3 forte dose': { classification: 'blocking', reason: 'Risque hémorragique majoré sous AVK à dose élevée (>3g).' },
  'berberine': { classification: 'blocking', reason: 'Potentialise l\'hypoglycémie sous insuline / antidiabétiques.' },
  'pamplemousse': { classification: 'blocking', reason: 'Inhibe le CYP3A4 — surdosage des statines.' },

  // — ADVISORY : aliments courants / consignes de timing / médicaments qu'un
  //   plan nutrition ne recommande pas. Mentionner ≠ contre-indication. —
  'soja': { classification: 'advisory', reason: 'Espacement d\'absorption (lévothyrox), pas une contre-indication.' },
  'calcium': { classification: 'advisory', reason: 'Espacement d\'absorption, pas une contre-indication.' },
  'fer': { classification: 'advisory', reason: 'Espacement d\'absorption, pas une contre-indication.' },
  'b12': { classification: 'advisory', reason: 'Surveillance biologique, pas une contre-indication.' },
  'ipp': { classification: 'advisory', reason: 'Médicament — non recommandé par un plan nutrition.' },
  'ains': { classification: 'advisory', reason: 'Médicament — non recommandé par un plan nutrition.' },
  'tramadol': { classification: 'advisory', reason: 'Médicament — non recommandé par un plan nutrition.' },
  'vinaigre': { classification: 'advisory', reason: 'Aliment courant.' },
  'hydratation': { classification: 'advisory', reason: 'Consigne générale, pas une substance.' },

  // — Volontairement ABSENTS → needs_review (fail-closed, à trancher Anissa) :
  //   chrome, cannelle, … (compléments dont le statut bloquant/advisory n'est
  //   pas tranché — on les signale pour revue plutôt que de les laisser passer).
};

/** Normalise pour matching : minuscule + suppression des accents. */
export function normalizeForMatch(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Classe une interaction (intitulé brut issu de detectTreatments).
 * @param {string} rawInteraction - ex. 'Millepertuis', 'Calcium a distance 4h'
 * @returns {'blocking'|'advisory'|'needs_review'}
 */
export function classifyInteraction(rawInteraction) {
  const norm = normalizeForMatch(rawInteraction);
  if (!norm) return 'needs_review';
  for (const key of Object.keys(INTERACTION_CLASSIFICATION)) {
    if (norm.includes(key)) return INTERACTION_CLASSIFICATION[key].classification;
  }
  return 'needs_review'; // fail-closed : non listé = à valider, pas advisory
}
