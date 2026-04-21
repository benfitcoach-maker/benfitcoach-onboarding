// ═══════════════════════════════════════════════════════════════════════
// V80 — Détection du mode de plan nutrition : one-shot vs followup
//
// Le mode est déterminé à partir de `client.packType` (déjà en base).
// Aucune nouvelle donnée, aucune migration.
//
//   - oneshot_180, oneshot_280, oneshot_750  → 'oneshot' (bilan individuel)
//   - suivi_3m, suivi_6m, suivi_adn          → 'followup' (accompagnement)
//   - tout le reste / absent                 → 'followup' (safe default)
//
// Le mode pilote :
//   - le prompt système IA (ONESHOT_PLAN_PROMPT vs FOUR_WEEKS_PROMPT)
//   - un badge discret dans l'UI
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {{ packType?: string, pack_type?: string }} client
 * @returns {'oneshot' | 'followup'}
 */
export function getNutritionPlanMode(client) {
  const packType = client?.packType || client?.pack_type || '';
  if (typeof packType === 'string' && packType.startsWith('oneshot')) {
    return 'oneshot';
  }
  return 'followup';
}

/**
 * Label court pour affichage UI.
 */
export function planModeLabel(mode) {
  return mode === 'oneshot' ? 'Bilan individuel' : 'Suivi';
}

/**
 * Description longue (pour tooltip / aide contextuelle si besoin).
 */
export function planModeDescription(mode) {
  return mode === 'oneshot'
    ? 'Consultation unique — plan autonome à appliquer seul pendant 4 semaines.'
    : 'Accompagnement continu — plan évolutif avec ajustements prévus.';
}
