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
// Mapping métier (cf. cartographie d'audit 2026-05-12, mis à jour V97.13) :
//
// Note V97.13 : depuis V97.10 le RDV anamnèse est une feature distincte du
// SaaS (BLOC 3 Onboarding avec journey_state.rdv_anamnesis_at + sync push
// vers clients.rdv_scheduled_at côté app cliente). Le mapping ci-dessous
// ne gère plus rdv_scheduled/rdv_done qui sont pilotés directement par
// les actions RDV du SaaS (pas par la transition d'étape SaaS).
//
// Quand Anissa valide l'anamnèse (passage SaaS anamnesis → analyses),
// la cliente passe directement à "analyses" (Vos analyses sanguines) car
// l'étape rdv_scheduled/rdv_done est déjà gérée par les sync RDV
// précédentes (V97.10 Phase B).
const SAAS_TO_CLIENT_APP = {
  anamnesis:       'questionnaire',       // Anissa onboarde → cliente remplit pré-questionnaire
  analyses:        'analyses',            // V97.13 fix : était 'rdv_scheduled' (obsolète depuis V97.10). Anissa valide l'anamnèse + prescrit analyses → cliente bascule sur "Vos analyses sanguines"
  waiting_results: 'analyses',            // Attente résultats labo (cliente reste sur Vos analyses)
  results:         'analyses',            // Anissa saisit résultats (mêmes côté cliente)
  plan_generation: 'program_in_progress', // IA génère plan
  plan_editing:    'program_in_progress', // Anissa édite plan
  delivery:        'program_active',      // Plan livré → cliente voit /plan
  followup:        'program_active',      // Suivi (état terminal côté cliente)
};

/**
 * Pousse l'état cliente correspondant à l'étape SaaS, en best-effort.
 * Ne throw jamais (les transitions SaaS ne doivent pas être bloquées si l'app
 * cliente est down ou l'env CLIENT_APP_API_URL pas configuré).
 *
 * V97.13.22 — accepte aussi des "events" pour pousser les timestamps du
 * workflow hybride (protocol_shipped, protocol_received) qui ne mappent pas
 * vers un nouveau journey_status (l'enum cliente reste 'program_in_progress'
 * pendant ces sous-états — c'est l'UI qui lit les timestamps directement).
 *
 * @param {string} clientId - id Supabase de la cliente côté SaaS
 * @param {string} saasStepOrEvent - clé JOURNEY_STEPS SaaS OU event spécial
 *   ('protocol_shipped' | 'protocol_received')
 */
async function syncClientAppStatus(clientId, saasStepOrEvent) {
  // V97.13.22 — events spéciaux qui ne changent pas le journey_status
  // mais pushent les timestamps dédiés vers la DB cliente.
  const isShippedEvent = saasStepOrEvent === 'protocol_shipped';
  const isReceivedEvent = saasStepOrEvent === 'protocol_received';
  const targetStatus = SAAS_TO_CLIENT_APP[saasStepOrEvent];

  if (!targetStatus && !isShippedEvent && !isReceivedEvent) return;

  try {
    const { data: client } = await supabase
      .from('clients')
      .select('form')
      .eq('id', clientId)
      .maybeSingle();
    const email = client?.form?.email;
    if (!email) return;

    const payload = { email };
    if (targetStatus) payload.status = targetStatus;
    if (isShippedEvent) payload.protocol_shipped_at = new Date().toISOString();
    if (isReceivedEvent) payload.protocol_received_at = new Date().toISOString();

    await clientAppFetch('/api/admin/client-journey-status', {
      method: 'POST',
      payload,
    });
  } catch (e) {
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
  plan_generated: false,
  plan_validated: false,
  // V97.13.22 — workflow hybride physique + digital :
  //   1. protocol_shipped=true  → Anissa a expédié le courrier
  //   2. client_received_confirmed=true → cliente a cliqué "J'ai reçu" dans l'app
  //   3. delivered=true → Anissa a activé l'espace cliente (étape 8 démarre)
  // Avant V97.13.22 : delivered=true tout de suite, sans étape physique.
  protocol_shipped: false,
  protocol_shipped_at: null,         // timestamp ISO
  client_received_confirmed: false,
  protocol_received_at: null,        // timestamp ISO
  delivered: false,                  // = espace cliente activé (workflow final)
  followup_started: false,
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
  // V97.13.22 — étape 1 du workflow hybride : Anissa marque le protocole
  // comme expédié physiquement. L'app cliente bascule en "attente réception"
  // (état partiel). Le journey reste sur 'delivery' — pas encore étape 8.
  markProtocolShipped: async (clientId) => {
    const now = new Date().toISOString();
    const next = await updateJourneyState(clientId, {
      protocol_shipped: true,
      protocol_shipped_at: now,
    });
    trackStepTransition({ clientId, fromStep: 'delivery', toStep: 'delivery', direction: 'shipped' });
    syncClientAppStatus(clientId, 'protocol_shipped'); // l'app cliente passe en attente
    return next;
  },

  // V97.13.22 — étape 2 : cliente confirme dans son app qu'elle a reçu le
  // courrier (OU Anissa confirme manuellement si cliente ne clique pas).
  // Ne déclenche PAS l'activation finale — Anissa garde le contrôle.
  confirmProtocolReceived: async (clientId) => {
    const now = new Date().toISOString();
    const next = await updateJourneyState(clientId, {
      client_received_confirmed: true,
      protocol_received_at: now,
    });
    trackStepTransition({ clientId, fromStep: 'delivery', toStep: 'delivery', direction: 'received' });
    syncClientAppStatus(clientId, 'protocol_received');
    return next;
  },

  // V97.13.22 — étape 3 : Anissa active l'espace cliente (= ancien markDelivered).
  // L'app cliente débloque le protocole complet. Le journey passe à 'followup'.
  // Le pack timeline (S4 → S24) se déclenche à partir de cette date.
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
      // eslint-disable-next-line no-console
      console.warn('[markDelivered] Could not update pack flags:', e?.message);
    }
    trackStepTransition({ clientId, fromStep: 'delivery', toStep: 'followup' });
    syncClientAppStatus(clientId, 'followup');
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
