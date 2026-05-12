// ─────────────────────────────────────────────────────────────────
// Phase D + E — Helpers d'etat du Parcours Cliente (8 etapes)
// Date : 2026-05-10
//
// Le parcours cliente est un wizard linaire : 8 etapes verrouillees
// (Anamnese → Analyses → Attente → Resultats → Generation plan →
//  Edition plan → Livraison → Suivi). L'etat vit dans le JSONB
// `clients.journey_state` (cf. migration D.0).
//
// Conditions de deblocage :
//   - anamnesis : toujours active au depart
//   - analyses : anamnesis_validated
//   - waiting_results : analyses_validated (skip → saute direct a plan_generation)
//   - results : results_received
//   - plan_generation : analyses_skipped OR results_validated
//   - plan_editing : plan_generated
//   - delivery : plan_validated
//   - followup : delivered
//
// Pas de "navigation libre" : seule l'etape current_step est active,
// les autres sont locked / validated / skipped.
// ─────────────────────────────────────────────────────────────────

import { supabase } from '../supabaseClient';
import { trackStepTransition } from './observability';
import { clientAppFetch } from './clientAppFetch';

// V97.4 (2026-05-12) — Sync auto SaaS BC.5 → app cliente journey_status.
// Avant ce mapping, Anissa devait avancer manuellement la timeline cliente
// via le JourneyCockpit en plus de sa propre timeline SaaS. Risque énorme
// d'oublis + clientes bloquées en 'welcome' (cas Camille 2026-05-12).
//
// Maintenant : chaque transition SaaS pousse automatiquement l'état cliente
// correspondant via clientAppFetch (best-effort, ne bloque jamais la
// transition SaaS si la sync échoue — l'observability tracking continue).
//
// Mapping métier (cf. cartographie d'audit 2026-05-12) :
const SAAS_TO_CLIENT_APP = {
  anamnesis:       'questionnaire',      // Anissa onboarde → cliente remplit pré-questionnaire
  analyses:        'rdv_scheduled',      // Anissa prescrit analyses → RDV anamnèse fixé
  waiting_results: 'analyses',           // Attente résultats labo
  results:         'analyses',           // Anissa saisit résultats (mêmes côté cliente)
  plan_generation: 'program_in_progress',// IA génère plan
  plan_editing:    'program_in_progress',// Anissa édite plan
  delivery:        'program_active',     // Plan livré → cliente voit /plan
  followup:        'program_active',     // Suivi (état terminal côté cliente)
};

/**
 * Pousse l'état cliente correspondant à l'étape SaaS, en best-effort.
 * Ne throw jamais (les transitions SaaS ne doivent pas être bloquées si l'app
 * cliente est down ou l'env CLIENT_APP_API_URL pas configuré).
 *
 * @param {string} clientId - id Supabase de la cliente côté SaaS
 * @param {string} saasStep - clé JOURNEY_STEPS SaaS (ex 'results')
 */
async function syncClientAppStatus(clientId, saasStep) {
  const targetStatus = SAAS_TO_CLIENT_APP[saasStep];
  if (!targetStatus) return; // étape inconnue → no-op silencieux

  try {
    // Récupère l'email de la cliente (l'API admin client app accepte
    // email OR client_id, on utilise email pour rester en phase avec
    // les autres appels clientAppFetch du SaaS).
    const { data: client } = await supabase
      .from('clients')
      .select('form')
      .eq('id', clientId)
      .maybeSingle();
    const email = client?.form?.email;
    if (!email) return; // cliente sans email → on ne peut pas la matcher côté app

    await clientAppFetch('/api/admin/client-journey-status', {
      method: 'POST',
      payload: { email, status: targetStatus },
    });
  } catch (e) {
    // Best-effort : log + continue (la transition SaaS reste valide même
    // si la sync app échoue). Sera retentée à la prochaine transition.
    console.warn('[journeyState] syncClientAppStatus failed:', e?.message || e);
  }
}

export const JOURNEY_STEPS = [
  'anamnesis',
  'analyses',
  'waiting_results',
  'results',
  'plan_generation',
  'plan_editing',
  'delivery',
  'followup',
];

export const STEP_META = {
  // BB.1 (2026-05-11) : 'Anamnèse' → 'Onboarding'. La 1ère étape n'est plus
  // juste 'vérifier l'anamnèse' mais l'onboarding complet : configurer le
  // mode d'accompagnement (app, papier, poids, notifs) + envoyer le pré-
  // questionnaire + recevoir les réponses + valider. Plus large et plus
  // proche du workflow réel d'Anissa. Clé interne 'anamnesis' conservée pour
  // backward compat (clientes existantes en BDD avec current_step='anamnesis').
  anamnesis:       { index: 1, label: 'Onboarding',        icon: '🎯' },
  analyses:        { index: 2, label: 'Analyses',          icon: '🧪' },
  waiting_results: { index: 3, label: 'Attente résultats', icon: '⏳' },
  results:         { index: 4, label: 'Saisie résultats',  icon: '📥' },
  plan_generation: { index: 5, label: 'Génération plan',   icon: '✨' },
  plan_editing:    { index: 6, label: 'Édition plan',      icon: '🥗' },
  delivery:        { index: 7, label: 'Livraison',         icon: '📨' },
  followup:        { index: 8, label: 'Suivi',             icon: '🔄' },
};

export const DEFAULT_JOURNEY_STATE = {
  current_step: 'anamnesis',
  anamnesis_validated: false,
  analyses_skipped: false,
  analyses_validated: false,
  results_received: false,
  results_validated: false,
  plan_generated: false,   // existe deja en BDD, devient "plan IA produit une fois"
  plan_validated: false,   // NEW : Anissa a relu/edite le plan dans le composer
  delivered: false,        // NEW : plan envoye a la cliente (PDF, app)
  followup_started: false, // NEW : cycle review / suivi enclenche
};

/**
 * Statut visuel d'une etape pour la sidebar.
 * Returns 'validated' | 'active' | 'locked' | 'skipped'
 */
// Backwards compat : les clientes pre-Phase E ont current_step='analyses'
// (ancien defaut Phase D) sans anamnesis_validated explicite. Si on est deja
// dans un step post-anamnesis, on considere l'anamnese comme implicitement
// faite — evite une migration data SQL pour les 5 clientes existantes.
const POST_ANAMNESIS_STEPS = ['analyses', 'waiting_results', 'results', 'plan_generation', 'plan_editing', 'delivery', 'followup'];

export function getStepStatus(state, step) {
  const s = { ...DEFAULT_JOURNEY_STATE, ...(state || {}) };
  const isActive = (k) => s.current_step === k;
  const effectiveAnamnesisValidated = s.anamnesis_validated || POST_ANAMNESIS_STEPS.includes(s.current_step);

  switch (step) {
    case 'anamnesis':
      if (effectiveAnamnesisValidated) return 'validated';
      return isActive('anamnesis') ? 'active' : 'locked';

    case 'analyses':
      if (s.analyses_skipped) return 'skipped';
      if (s.analyses_validated) return 'validated';
      if (!effectiveAnamnesisValidated) return 'locked';
      return isActive('analyses') ? 'active' : 'locked';

    case 'waiting_results':
      if (s.analyses_skipped) return 'skipped';
      if (s.results_received) return 'validated';
      if (!s.analyses_validated) return 'locked';
      return isActive('waiting_results') ? 'active' : 'locked';

    case 'results':
      if (s.analyses_skipped) return 'skipped';
      if (s.results_validated) return 'validated';
      if (!s.results_received) return 'locked';
      return isActive('results') ? 'active' : 'locked';

    case 'plan_generation': {
      if (s.plan_generated) return 'validated';
      const unlocked = s.analyses_skipped || s.results_validated;
      if (!unlocked) return 'locked';
      return isActive('plan_generation') ? 'active' : 'locked';
    }

    case 'plan_editing':
      if (s.plan_validated) return 'validated';
      if (!s.plan_generated) return 'locked';
      return isActive('plan_editing') ? 'active' : 'locked';

    case 'delivery':
      if (s.delivered) return 'validated';
      if (!s.plan_validated) return 'locked';
      return isActive('delivery') ? 'active' : 'locked';

    case 'followup':
      if (s.followup_started) return 'validated';
      if (!s.delivered) return 'locked';
      return isActive('followup') ? 'active' : 'locked';

    default:
      return 'locked';
  }
}

/**
 * Patch partiel du journey_state. Merge cote serveur via jsonb_set,
 * mais ici on relit + reecrit l'objet entier (simple, suffisant tant
 * qu'on a 1 seul ecrivain a la fois — le wizard).
 */
export async function updateJourneyState(clientId, patch) {
  if (!clientId) throw new Error('clientId requis');
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
 * Transitions metier pour les 8 etapes.
 * Chaque transition emet un event step_transition (best-effort, ne bloque jamais)
 * pour la couche observabilite — captures temps reel d'utilisation Anissa.
 */
export const transitions = {
  // Etape 1 → 2
  validateAnamnesis: async (clientId) => {
    const r = await updateJourneyState(clientId, { anamnesis_validated: true, current_step: 'analyses' });
    trackStepTransition({ clientId, fromStep: 'anamnesis', toStep: 'analyses' });
    syncClientAppStatus(clientId, 'analyses'); // V97.4 — sync auto
    return r;
  },
  // Etape 2 → 3
  validateAnalyses: async (clientId) => {
    const r = await updateJourneyState(clientId, { analyses_validated: true, current_step: 'waiting_results' });
    trackStepTransition({ clientId, fromStep: 'analyses', toStep: 'waiting_results' });
    syncClientAppStatus(clientId, 'waiting_results');
    return r;
  },
  // Etape 2 skip → 5 (saute attente, resultats — direct generation plan)
  skipAnalyses: async (clientId) => {
    const r = await updateJourneyState(clientId, { analyses_skipped: true, current_step: 'plan_generation' });
    trackStepTransition({ clientId, fromStep: 'analyses', toStep: 'plan_generation', direction: 'skip' });
    syncClientAppStatus(clientId, 'plan_generation');
    return r;
  },
  // Etape 3 → 4
  markResultsReceived: async (clientId) => {
    const r = await updateJourneyState(clientId, { results_received: true, current_step: 'results' });
    trackStepTransition({ clientId, fromStep: 'waiting_results', toStep: 'results' });
    syncClientAppStatus(clientId, 'results');
    return r;
  },
  // Etape 4 → 5
  validateResults: async (clientId) => {
    const r = await updateJourneyState(clientId, { results_validated: true, current_step: 'plan_generation' });
    trackStepTransition({ clientId, fromStep: 'results', toStep: 'plan_generation' });
    syncClientAppStatus(clientId, 'plan_generation');
    return r;
  },
  // Etape 5 → 6
  markPlanGenerated: async (clientId) => {
    const r = await updateJourneyState(clientId, { plan_generated: true, current_step: 'plan_editing' });
    trackStepTransition({ clientId, fromStep: 'plan_generation', toStep: 'plan_editing' });
    syncClientAppStatus(clientId, 'plan_editing');
    return r;
  },
  // Etape 6 → 7
  validatePlan: async (clientId) => {
    const r = await updateJourneyState(clientId, { plan_validated: true, current_step: 'delivery' });
    trackStepTransition({ clientId, fromStep: 'plan_editing', toStep: 'delivery' });
    syncClientAppStatus(clientId, 'delivery');
    return r;
  },
  // Etape 7 → 8
  // AY (2026-05-11) : en plus du journey_state, on update aussi les champs
  // pack côté client (packStartedAt + packStartedAtConfirmed) pour que la
  // timeline pack du dashboard (S4 → S24) se déclenche automatiquement.
  // Avant : il fallait cliquer 'Marquer comme remis' séparément. Maintenant :
  // valider la livraison étape 7 → timeline + cockpit suivi automatiques.
  markDelivered: async (clientId) => {
    const now = new Date().toISOString();
    const next = await updateJourneyState(clientId, {
      delivered: true,
      current_step: 'followup',
      delivered_at: now,
    });
    // Update pack delivery flags pour activer la timeline dashboard
    try {
      await supabase
        .from('clients')
        .update({
          packStartedAt: now,
          packStartedAtConfirmed: true,
        })
        .eq('id', clientId);
    } catch (e) {
      // Pas bloquant : le journey_state est déjà mis à jour. La timeline
      // peut être activée manuellement via 'Modifier la date de remise' du menu Plus.
      // eslint-disable-next-line no-console
      console.warn('[markDelivered] Could not update pack flags:', e?.message);
    }
    trackStepTransition({ clientId, fromStep: 'delivery', toStep: 'followup' });
    syncClientAppStatus(clientId, 'followup'); // V97.4 — sync auto → program_active
    return next;
  },
  // Etape 8 (terminal — pas de transition, juste flag)
  startFollowup: async (clientId) => {
    const r = await updateJourneyState(clientId, { followup_started: true });
    syncClientAppStatus(clientId, 'followup'); // V97.4 — idempotent (déjà program_active)
    return r;
  },

  // Phase K : navigation libre arriere. Permet de revenir consulter une etape
  // precedente sans perdre les booleans de validation. NE TOUCHE PAS aux
  // _validated / _skipped : juste un curseur de navigation. La cliente peut
  // reprendre la suite via les boutons de validation classiques.
  goToPreviousStep: async (clientId, currentStepKey) => {
    const idx = JOURNEY_STEPS.indexOf(currentStepKey);
    if (idx <= 0) return null;
    const previous = JOURNEY_STEPS[idx - 1];
    const r = await updateJourneyState(clientId, { current_step: previous });
    trackStepTransition({ clientId, fromStep: currentStepKey, toStep: previous, direction: 'backward' });
    return r;
  },

  // Phase AF : depuis l'etape 8 Suivi (cockpit vivant), permet de re-rentrer
  // dans le cycle Editer → Livrer → Suivre sans perdre le statut "follow_up".
  // Ne reset PAS les booleans validated/delivered/etc — juste replace le
  // curseur sur plan_editing pour qu'Anissa adapte le plan depuis les
  // derniers ressentis. Apres re-publication, restartFollowup revient sur
  // l'etape 8.
  restartPlanEditing: async (clientId) => {
    const r = await updateJourneyState(clientId, { current_step: 'plan_editing' });
    trackStepTransition({ clientId, fromStep: 'followup', toStep: 'plan_editing', direction: 'backward' });
    return r;
  },
  // Apres une re-publication, retour direct a l'etape 8 cockpit.
  returnToFollowup: async (clientId) => {
    const r = await updateJourneyState(clientId, { current_step: 'followup' });
    trackStepTransition({ clientId, fromStep: 'plan_editing', toStep: 'followup' });
    return r;
  },

  // Phase AJ : enregistre une consultation (RDV cabinet/visio) effectuee.
  // Append-only dans journey_state.consultations_log = [{date, notes}].
  // Le compteur "X/Y consultations" du header se base sur la longueur du tableau.
  // Note : on lit l'etat courant pour merger l'array, sinon updateJourneyState
  // ecraserait toute la cle consultations_log.
  logConsultation: async (clientId, { notes = '' } = {}) => {
    if (!clientId) throw new Error('clientId requis');
    const { data: current, error: loadErr } = await supabase
      .from('clients')
      .select('journey_state')
      .eq('id', clientId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    const state = current?.journey_state || {};
    const log = Array.isArray(state.consultations_log) ? state.consultations_log : [];
    const next = [
      ...log,
      { date: new Date().toISOString(), notes: (notes || '').trim() },
    ];
    return updateJourneyState(clientId, { consultations_log: next });
  },

  // Supprime la derniere entree du log (pour annuler un clic accidentel).
  removeLastConsultation: async (clientId) => {
    if (!clientId) throw new Error('clientId requis');
    const { data: current, error: loadErr } = await supabase
      .from('clients')
      .select('journey_state')
      .eq('id', clientId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    const state = current?.journey_state || {};
    const log = Array.isArray(state.consultations_log) ? state.consultations_log : [];
    if (log.length === 0) return state;
    return updateJourneyState(clientId, { consultations_log: log.slice(0, -1) });
  },
};
