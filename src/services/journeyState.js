// ─────────────────────────────────────────────────────────────────
// Phase D — Helpers d'etat du Parcours Cliente
// Date : 2026-05-10
//
// Le parcours cliente est un wizard linaire : 4 etapes verrouillees
// (Analyses → Attente → Resultats → Plan). L'etat vit dans le JSONB
// `clients.journey_state` (cf. migration D.0).
//
// L'etape Plan se debloque si :
//   - analyses_skipped (pack sans analyses), OU
//   - results_validated (analyses faites + resultats traites)
//
// Pas de "navigation libre" : seule l'etape current_step est active,
// les autres sont locked ou validated. C'est la promesse UX V4.
// ─────────────────────────────────────────────────────────────────

import { supabase } from '../supabaseClient';

export const JOURNEY_STEPS = ['analyses', 'waiting_results', 'results', 'plan'];

export const STEP_META = {
  analyses: { index: 1, label: 'Analyses', icon: '🧪' },
  waiting_results: { index: 2, label: 'Attente résultats', icon: '⏳' },
  results: { index: 3, label: 'Saisie résultats', icon: '📥' },
  plan: { index: 4, label: 'Plan nutritionnel', icon: '🥗' },
};

export const DEFAULT_JOURNEY_STATE = {
  current_step: 'analyses',
  analyses_skipped: false,
  analyses_validated: false,
  results_received: false,
  results_validated: false,
  plan_generated: false,
};

/**
 * Statut visuel d'une etape pour la sidebar.
 * Returns 'validated' | 'active' | 'locked' | 'skipped'
 */
export function getStepStatus(state, step) {
  const s = state || DEFAULT_JOURNEY_STATE;
  if (step === 'analyses') {
    if (s.analyses_skipped) return 'skipped';
    if (s.analyses_validated) return 'validated';
    return s.current_step === 'analyses' ? 'active' : 'locked';
  }
  if (step === 'waiting_results') {
    if (s.analyses_skipped) return 'skipped';
    if (s.results_received) return 'validated';
    if (!s.analyses_validated) return 'locked';
    return s.current_step === 'waiting_results' ? 'active' : 'locked';
  }
  if (step === 'results') {
    if (s.analyses_skipped) return 'skipped';
    if (s.results_validated) return 'validated';
    if (!s.results_received) return 'locked';
    return s.current_step === 'results' ? 'active' : 'locked';
  }
  if (step === 'plan') {
    if (s.plan_generated) return 'validated';
    const unlocked = s.analyses_skipped || s.results_validated;
    if (!unlocked) return 'locked';
    return s.current_step === 'plan' ? 'active' : 'locked';
  }
  return 'locked';
}

/**
 * Patch partiel du journey_state. Merge cote serveur via jsonb_set,
 * mais ici on relit + reecrit l'objet entier (simple, suffisant tant
 * qu'on a 1 seul ecrivain a la fois — le wizard).
 */
export async function updateJourneyState(clientId, patch) {
  if (!clientId) throw new Error('clientId requis');
  // Recharge l'etat actuel (Source de verite serveur)
  const { data: current, error: loadErr } = await supabase
    .from('clients')
    .select('journey_state')
    .eq('id', clientId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);

  const merged = { ...DEFAULT_JOURNEY_STATE, ...(current?.journey_state || {}), ...patch };

  const { data, error } = await supabase
    .from('clients')
    .update({ journey_state: merged })
    .eq('id', clientId)
    .select('journey_state')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.journey_state || merged;
}

/**
 * Transitions metier (plus expressif que setter brut).
 */
export const transitions = {
  /** Etape 1 → 2 : Analyses validees, on passe en attente resultats. */
  validateAnalyses: (clientId) => updateJourneyState(clientId, {
    analyses_validated: true,
    current_step: 'waiting_results',
  }),
  /** Etape 1 skip : pack sans analyses, on saute direct au plan. */
  skipAnalyses: (clientId) => updateJourneyState(clientId, {
    analyses_skipped: true,
    current_step: 'plan',
  }),
  /** Etape 2 → 3 : Resultats recus, Anissa peut commencer la saisie. */
  markResultsReceived: (clientId) => updateJourneyState(clientId, {
    results_received: true,
    current_step: 'results',
  }),
  /** Etape 3 → 4 : Resultats traites, plan debloque. */
  validateResults: (clientId) => updateJourneyState(clientId, {
    results_validated: true,
    current_step: 'plan',
  }),
  /** Etape 4 : plan genere → fin du parcours actif. */
  markPlanGenerated: (clientId) => updateJourneyState(clientId, {
    plan_generated: true,
  }),
};
