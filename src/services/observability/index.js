// ─────────────────────────────────────────────────────────────────
// V97.3 — Couche observabilité clinique
// Date : 2026-05-12
//
// Objectif : capturer le raisonnement clinique réel d'Anissa pour
// pouvoir l'apprendre plus tard. Pas des analytics SaaS.
//
// Principes :
//   - APPEND-ONLY (aucun update, aucun delete)
//   - Timestamp serveur (jamais client — faussable)
//   - Pas de logique métier dedans (juste tracking)
//   - Best-effort silencieux (ne casse jamais le workflow Anissa)
//
// Architecture :
//   - trackEvent(eventType, payload, ctx) → append vers clinical_events
//   - EVENT_TYPES centralise les noms (pas de strings volants)
//   - eventSchemas valide le payload (dev-time warnings)
//
// Phases d'implémentation (cf. discussion 2026-05-12) :
//   A. step_transition (workflow temps) ← LIVRÉ
//   B. plan_generated (coût/durée IA)   ← TODO
//   C. plan_modification (source + reason) ← TODO (le plus stratégique)
// ─────────────────────────────────────────────────────────────────

import { supabase } from '../../supabaseClient';

/**
 * Catalogue centralisé des types d'événements.
 * Pas de string volantes dans le reste du code — toujours référencer
 * via EVENT_TYPES.X. Ajout d'un nouveau type = ajout ici + schema.
 */
export const EVENT_TYPES = Object.freeze({
  // Phase A — workflow temps
  STEP_TRANSITION: 'step_transition',

  // Phase B — génération IA (success + failure)
  PLAN_GENERATED: 'plan_generated',
  PLAN_GENERATION_FAILED: 'plan_generation_failed',

  // Phase C — modifications humaines (à venir)
  PLAN_MODIFICATION: 'plan_modification',

  // Réservés futurs (placeholders pour design forward)
  PLAN_VALIDATED: 'plan_validated',
  CLIENT_FEEDBACK_RECEIVED: 'client_feedback_received',
  CONSULTATION_LOGGED: 'consultation_logged',
});

/**
 * Schémas de validation des payloads (dev-time seulement).
 * Si payload non conforme → console.warn + tracking quand même.
 * Permet de détecter les régressions sans bloquer.
 *
 * Format : { field: 'type' | ['type1', 'type2'] }
 * Types : 'string', 'number', 'boolean', 'object', 'optional:string', etc.
 */
const EVENT_SCHEMAS = {
  [EVENT_TYPES.STEP_TRANSITION]: {
    from_step: 'string',
    to_step: 'string',
    direction: 'string', // 'forward' | 'backward' | 'skip'
  },
  [EVENT_TYPES.PLAN_GENERATED]: {
    model: 'string',
    duration_ms: 'number',
    success: 'boolean',
    composer_beta: 'optional:boolean',
    tokens_estimated: 'optional:number',
    prompt_hash: 'optional:string',
    sections_generated: 'optional:object', // array
  },
  [EVENT_TYPES.PLAN_GENERATION_FAILED]: {
    model: 'string',
    duration_ms: 'number',
    error_type: 'string',
    error_message_safe: 'optional:string',
    composer_beta: 'optional:boolean',
  },
  [EVENT_TYPES.PLAN_MODIFICATION]: {
    section: 'string',
    source: 'string', // 'ai' | 'practitioner' | 'hybrid'
    reason_code: 'optional:string',
    before_len: 'optional:number',
    after_len: 'optional:number',
  },
};

/**
 * Valide un payload contre son schéma. Retourne la liste des erreurs
 * (vide = OK). Ne throw jamais — c'est best-effort.
 */
function validatePayload(eventType, payload) {
  const schema = EVENT_SCHEMAS[eventType];
  if (!schema) return [];
  const errors = [];
  for (const [field, spec] of Object.entries(schema)) {
    const isOptional = typeof spec === 'string' && spec.startsWith('optional:');
    const expectedType = isOptional ? spec.slice('optional:'.length) : spec;
    const value = payload?.[field];
    if (value === undefined || value === null) {
      if (!isOptional) errors.push(`missing field "${field}"`);
      continue;
    }
    if (expectedType === 'number' && typeof value !== 'number') {
      errors.push(`field "${field}" expected number, got ${typeof value}`);
    } else if (expectedType === 'string' && typeof value !== 'string') {
      errors.push(`field "${field}" expected string, got ${typeof value}`);
    } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
      errors.push(`field "${field}" expected boolean, got ${typeof value}`);
    } else if (expectedType === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push(`field "${field}" expected object, got ${typeof value}`);
    }
  }
  return errors;
}

/**
 * Append un événement clinique. Best-effort : ne throw jamais, ne
 * bloque jamais le workflow Anissa. En cas d'erreur réseau / DB,
 * on log silencieusement et on continue.
 *
 * @param {string} eventType - un des EVENT_TYPES
 * @param {object} payload - données spécifiques (cf. EVENT_SCHEMAS)
 * @param {object} [ctx] - contexte optionnel
 * @param {string} [ctx.clientId] - cliente concernée (null pour events globaux)
 * @param {string} [ctx.consultationId] - consultation concernée
 *
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function trackEvent(eventType, payload = {}, ctx = {}) {
  // Validation dev-time (warn mais ne bloque pas)
  const errors = validatePayload(eventType, payload);
  if (errors.length > 0 && typeof window !== 'undefined' && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[observability] ${eventType} payload invalide:`, errors, payload);
  }

  try {
    // Récupère l'identité praticien (auth Supabase)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      // Anissa pas authentifiée — on skip silencieusement
      return { ok: false, error: 'no_auth' };
    }

    const row = {
      practitioner_id: user.id,
      event_type: eventType,
      client_id: ctx.clientId || null,
      consultation_id: ctx.consultationId || null,
      payload,
      // created_at = default now() côté DB (timestamp serveur, jamais client)
    };

    const { error } = await supabase.from('clinical_events').insert(row);
    if (error) {
      if (typeof window !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[observability] insert failed:', error.message);
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    // Catch tout — best-effort, ne casse jamais le caller
    if (typeof window !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[observability] trackEvent threw:', e?.message);
    }
    return { ok: false, error: e?.message || 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers spécifiques pour les events les plus communs
// (raccourcis avec validation forte côté JS)
// ─────────────────────────────────────────────────────────────────

/**
 * Enregistre une transition d'étape dans le parcours cliente.
 * Appelé depuis services/journeyState.js (toutes les transitions).
 *
 * @param {object} args
 * @param {string} args.clientId - cliente concernée
 * @param {string} args.fromStep - étape source (ex: 'anamnesis')
 * @param {string} args.toStep - étape destination (ex: 'analyses')
 * @param {string} [args.direction='forward'] - 'forward' | 'backward' | 'skip'
 */
export function trackStepTransition({ clientId, fromStep, toStep, direction = 'forward' }) {
  return trackEvent(
    EVENT_TYPES.STEP_TRANSITION,
    { from_step: fromStep, to_step: toStep, direction },
    { clientId },
  );
}

/**
 * Hash compact d'une string (djb2 modifié, 32-bit, hex 8 chars).
 * Utilisé pour fingerprinter les prompts système sans les stocker.
 * Permet de tracker l'évolution des prompts dans le temps.
 */
function hashStringFast(input) {
  if (!input || typeof input !== 'string') return null;
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Estime grossièrement le nombre de tokens depuis la longueur du texte.
 * Heuristique standard : ~4 chars / token en français/anglais.
 * Pas exact mais suffisant pour les tendances.
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.round(text.length / 4);
}

/**
 * Enregistre une génération IA réussie.
 * Appelé depuis JourneyPlanEditor.GenerationModal.handleGenerate après succès.
 *
 * @param {object} args
 * @param {string} args.clientId
 * @param {string} [args.consultationId]
 * @param {string} args.model - ex: 'claude-sonnet-4-20250514'
 * @param {number} args.durationMs - temps total IA
 * @param {string} [args.systemPrompt] - pour calculer le hash
 * @param {string} [args.responseText] - pour estimer les tokens
 * @param {boolean} [args.composerBeta=false]
 * @param {string[]} [args.sectionsGenerated=['plan']]
 */
export function trackPlanGenerated({
  clientId,
  consultationId,
  model,
  durationMs,
  systemPrompt,
  responseText,
  composerBeta = false,
  sectionsGenerated = ['plan'],
}) {
  return trackEvent(
    EVENT_TYPES.PLAN_GENERATED,
    {
      model,
      duration_ms: durationMs,
      success: true,
      composer_beta: composerBeta,
      tokens_estimated: estimateTokens(responseText),
      prompt_hash: hashStringFast(systemPrompt),
      sections_generated: sectionsGenerated,
    },
    { clientId, consultationId },
  );
}

/**
 * Enregistre une génération IA en échec.
 * Capture le type d'erreur sans contenu sensible (error_message_safe limité).
 *
 * @param {object} args
 * @param {string} args.clientId
 * @param {string} [args.consultationId]
 * @param {string} args.model
 * @param {number} args.durationMs - temps avant échec
 * @param {string} args.errorType - ex: 'api_error', 'timeout', 'rate_limit', 'composer_blocked'
 * @param {string} [args.errorMessageSafe] - message court, sans données sensibles
 * @param {boolean} [args.composerBeta=false]
 */
export function trackPlanGenerationFailed({
  clientId,
  consultationId,
  model,
  durationMs,
  errorType,
  errorMessageSafe,
  composerBeta = false,
}) {
  return trackEvent(
    EVENT_TYPES.PLAN_GENERATION_FAILED,
    {
      model,
      duration_ms: durationMs,
      error_type: errorType,
      // Tronqué à 200 chars pour éviter logs énormes et expositions accidentelles
      error_message_safe: errorMessageSafe ? String(errorMessageSafe).slice(0, 200) : undefined,
      composer_beta: composerBeta,
    },
    { clientId, consultationId },
  );
}
