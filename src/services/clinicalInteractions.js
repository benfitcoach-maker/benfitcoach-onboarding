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
//
// V1 FIGÉE (validé Anissa le 2026-06-10, réf. docs/VALIDATION-CLINIQUE-ANISSA-V1.md).
// Trois nature de classification :
//   - 'blocking'  : contre-indication inconditionnelle.
//   - 'advisory'  : mention non bloquante.
//   - CONDITIONNELLE : 'advisory' par défaut, escaladée en 'blocking' si un
//     traitement listé dans `escalateToBlockingIf` est ACTIF. La conditionnalité
//     reste une DONNÉE déclarative (liste de clés de traitement), pas du code de
//     décision — Anissa amende la liste, pas la logique.

/**
 * Classification par substance. Les clés sont des fragments normalisés
 * (minuscule, sans accent) recherchés en sous-chaîne dans l'intitulé brut de
 * l'interaction. `classification` : 'blocking' | 'advisory'.
 * `escalateToBlockingIf` (optionnel) : liste de clés de traitement
 * (cf. detectTreatments) qui font passer une substance 'advisory' en 'blocking'
 * lorsqu'au moins l'une est active.
 * Tout ce qui n'est pas listé → 'needs_review' (cf. classifyInteraction).
 */
export const INTERACTION_CLASSIFICATION = {
  // — BLOQUANT inconditionnel : plantes / compléments qu'un plan ne devrait pas
  //   recommander —
  'millepertuis': { classification: 'blocking', reason: 'Inducteur enzymatique (CYP3A4/P-gp) — réduit l\'efficacité de nombreux traitements (antidépresseurs, pilule, AVK, statines).' },
  'pamplemousse': { classification: 'blocking', reason: 'Inhibe le CYP3A4 — surdosage des statines.' },
  // Portée : la FORTE DOSE seule bloque (clé plus spécifique, prioritaire) ;
  // la dose normale reste advisory (clé générique 'vitamine k2' plus bas).
  'vitamine k2 forte dose': { classification: 'blocking', reason: 'Antagonise les AVK (vitamine K) à forte dose.' },

  // — CONDITIONNEL : advisory en population générale, bloquant si traitement
  //   précis actif (escalade déclarative) —
  'omega-3 forte dose': { classification: 'advisory', escalateToBlockingIf: ['avk', 'doac'], reason: 'Avertissement en population générale ; risque hémorragique majoré (bloquant) sous anticoagulant (AVK/AOD) à dose élevée (>3g).' },
  'berberine': { classification: 'advisory', escalateToBlockingIf: ['insuline', 'metformine'], reason: 'Avertissement en population générale ; potentialise l\'hypoglycémie (bloquant) sous insuline / metformine.' },

  // — ADVISORY inconditionnel : aliments courants / consignes de timing /
  //   médicaments / doses modérées qu'un plan nutrition ne recommande pas.
  //   Mentionner ≠ contre-indication. —
  'vitamine k2': { classification: 'advisory', reason: 'Dose normale : mention, pas une contre-indication (seule la forte dose bloque).' },
  'chrome': { classification: 'advisory', reason: 'Avertissement uniquement — pas d\'escalade bloquante sous insuline (décision Anissa).' },
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
  //   cannelle, … (compléments dont le statut bloquant/advisory n'est pas
  //   tranché — on les signale pour revue plutôt que de les laisser passer).
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
 * Vrai si au moins un des traitements listés est ACTIF dans le contexte donné.
 * `treatments` = map { cle: { active, interactions } } issue de detectTreatments.
 * @param {object|null|undefined} treatments
 * @param {string[]} keys
 * @returns {boolean}
 */
function hasActiveTreatment(treatments, keys) {
  if (!treatments || typeof treatments !== 'object') return false;
  return keys.some((k) => treatments[k] && treatments[k].active === true);
}

// Clés triées une fois par longueur décroissante : une clé spécifique
// ('vitamine k2 forte dose') doit l'emporter sur une clé générique
// ('vitamine k2') lors du matching en sous-chaîne.
const KEYS_BY_SPECIFICITY = Object.keys(INTERACTION_CLASSIFICATION).sort(
  (a, b) => b.length - a.length,
);

/**
 * Classe une interaction (intitulé brut issu de detectTreatments).
 *
 * Une substance conditionnelle (escalateToBlockingIf) est 'advisory' par
 * défaut et passe 'blocking' si l'un des traitements ciblés est actif. Passer
 * `treatments` est donc nécessaire pour l'escalade ; sans lui, la classification
 * par défaut s'applique (rétro-compatible).
 *
 * @param {string} rawInteraction - ex. 'Millepertuis', 'Calcium a distance 4h'
 * @param {object|null} [treatments] - map detectTreatments pour l'escalade conditionnelle
 * @returns {'blocking'|'advisory'|'needs_review'}
 */
export function classifyInteraction(rawInteraction, treatments = null) {
  const norm = normalizeForMatch(rawInteraction);
  if (!norm) return 'needs_review';
  for (const key of KEYS_BY_SPECIFICITY) {
    if (!norm.includes(key)) continue;
    const entry = INTERACTION_CLASSIFICATION[key];
    if (Array.isArray(entry.escalateToBlockingIf) && entry.escalateToBlockingIf.length > 0) {
      return hasActiveTreatment(treatments, entry.escalateToBlockingIf)
        ? 'blocking'
        : entry.classification;
    }
    return entry.classification;
  }
  return 'needs_review'; // fail-closed : non listé = à valider, pas advisory
}
