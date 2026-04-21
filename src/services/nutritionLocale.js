// ═══════════════════════════════════════════════════════════════════════
// V86 — Locale nutrition (FR / EN)
//
// Regle metier :
//   L'anglais V1 s'applique UNIQUEMENT aux clientes Benfitcoach avec
//   formule 'suivi' ou 'intensif' ET langue 'EN'.
//   Toutes les autres clientes (y compris one-shot EN) restent FR.
//
// Point unique de verite pour la detection locale. Utilise par :
//   - App.jsx (choix du mail questionnaire FR vs anamnese EN)
//   - NutritionConsultation.jsx (choix des prompts FR vs EN)
//   - nutritionPdf.js (labels FR vs EN, format date)
//   - cockpit header (badge FR/EN)
//
// Extension future (autres formules, autres langues) = 1 fichier a toucher.
// ═══════════════════════════════════════════════════════════════════════

export const LOCALES = Object.freeze({ FR: 'FR', EN: 'EN' });

/**
 * Retourne la locale nutrition a utiliser pour un client donne.
 * @param {object|null|undefined} client - objet client (peut avoir `formule`/`langue` au niveau racine ou dans `form`)
 * @returns {'FR'|'EN'}
 */
export function getClientNutritionLocale(client) {
  if (!client) return LOCALES.FR;
  const formule = String(client.formule || client.form?.formule || '').toLowerCase();
  const langue = String(client.langue || client.form?.langue || 'FR').toUpperCase();
  const isBenfitcoachFormule = formule === 'suivi' || formule === 'intensif';
  return (isBenfitcoachFormule && langue === 'EN') ? LOCALES.EN : LOCALES.FR;
}

/**
 * Indique si ce client doit recevoir l'anamnese complete EN directement
 * (et donc sauter le pre-questionnaire FR).
 * @param {object} client
 * @returns {boolean}
 */
export function shouldSkipPreQuestionnaire(client) {
  return getClientNutritionLocale(client) === LOCALES.EN;
}

/**
 * Helper de convenance pour tester si on est sur le parcours EN.
 * @param {object} client
 * @returns {boolean}
 */
export function isBenfitcoachEnClient(client) {
  return getClientNutritionLocale(client) === LOCALES.EN;
}
