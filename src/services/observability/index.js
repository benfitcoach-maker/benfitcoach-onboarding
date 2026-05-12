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

  // Phase B — génération IA (à venir)
  PLAN_GENERATED: 'plan_generated',

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
    duration_ms: 'number',
    model: 'string',
    composer_beta: 'optional:boolean',
    tokens_estimated: 'optional:number',
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
