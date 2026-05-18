// ─── planObservability.js ───────────────────────────────────────────────
// V97.20 (OBS-1) — Tracking des generations de plans nutrition.
//
// Cf migration : V97.20_plan_generation_observability.sql
//
// Usage typique :
//   1. Au lancement de la generation : startGenerationTracking() → recordId
//      (cree la row avec metrics initiaux du composer + audits)
//   2. Apres reformulation Haiku acceptee/refusee : recordSlopAction(id, ...)
//      (increment compteur correspondant)
//
// Toutes les fonctions sont fault-tolerantes : un echec d'observability
// ne casse jamais le flow principal de generation/edition (best-effort).

import { supabase } from '../supabaseClient';
import { summarizeSlopFlags } from './prompts/nutrition/_antiSlop.fr';

/**
 * Enregistre une nouvelle generation de plan avec ses metrics initiaux.
 * Doit etre appele apres callClaude + audits clinique + audit anti-slop.
 *
 * @param {object} args
 * @param {string} [args.clientId]
 * @param {string} [args.consultationId]
 * @param {number} [args.generationDurationMs]
 * @param {string} [args.model]
 * @param {boolean} [args.composerBeta]
 * @param {object} [args.profile] - Output de detectClientProfile (tag + all)
 * @param {Array} [args.guardrails] - Output de detectClinicalGuardrails
 * @param {Array} [args.violations] - Output de auditPlanForGuardrails
 * @param {object} [args.completeness] - Output de auditPlanCompleteness
 * @param {Array|null} [args.slopFlags] - Output de detectSlopHeuristics (null si pas lance)
 * @param {string} [args.planText]
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function recordPlanGeneration(args = {}) {
  const {
    clientId, consultationId, generationDurationMs, model,
    composerBeta = false, profile = null, guardrails = [],
    violations = [], completeness = null, slopFlags = null,
    planText = '',
  } = args;

  if (!clientId) {
    return { ok: false, error: 'clientId requis' };
  }

  const profileTags = [profile?.tag, ...(profile?.all || [])].filter(Boolean);
  const uniqueTags = Array.from(new Set(profileTags));

  // Slop summary
  let slopByCategory = {};
  let slopBySeverity = { high: 0, medium: 0, low: 0 };
  let slopCount = 0;
  if (Array.isArray(slopFlags)) {
    slopCount = slopFlags.length;
    const summary = summarizeSlopFlags(slopFlags);
    for (const s of summary) {
      slopByCategory[s.category] = s.count;
    }
    for (const f of slopFlags) {
      const sev = f.severity || 'low';
      slopBySeverity[sev] = (slopBySeverity[sev] || 0) + 1;
    }
  }

  const row = {
    client_id: clientId,
    consultation_id: consultationId || null,
    generation_duration_ms: Number.isFinite(generationDurationMs) ? Math.round(generationDurationMs) : null,
    model: model || null,
    composer_beta: !!composerBeta,
    detected_profile_tags: uniqueTags,
    guardrails_applied: (guardrails || []).map((g) => g.profile_key).filter(Boolean),
    violations_count: violations.length,
    violations: violations.slice(0, 50), // cap pour pas exploser la row
    missing_micronutrients_count: completeness?.missing_micronutrients?.length || 0,
    missing_evictions_count: completeness?.missing_evictions?.length || 0,
    missing_required_count: completeness?.missing_required_phrases?.length || 0,
    slop_flags_count: slopCount,
    slop_flags_by_category: slopByCategory,
    slop_flags_by_severity: slopBySeverity,
    plan_length_chars: typeof planText === 'string' ? planText.length : 0,
  };

  try {
    const { data, error } = await supabase
      .from('plan_generation_observability')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[obs] insert failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[obs] insert exception:', e?.message);
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Increment un compteur d'action slop sur une row existante.
 *
 * @param {string} observabilityId - id retourne par recordPlanGeneration
 * @param {'requested'|'accepted'|'refused'} action
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function recordSlopAction(observabilityId, action) {
  if (!observabilityId) return { ok: false, error: 'id requis' };
  const fieldMap = {
    requested: 'slop_rewrites_requested_count',
    accepted: 'slop_rewrites_accepted_count',
    refused: 'slop_rewrites_refused_count',
  };
  const field = fieldMap[action];
  if (!field) return { ok: false, error: `action invalide: ${action}` };

  try {
    // Read-modify-write (Supabase JS pas de RPC increment natif simple)
    const { data: current, error: readErr } = await supabase
      .from('plan_generation_observability')
      .select(field)
      .eq('id', observabilityId)
      .single();
    if (readErr) return { ok: false, error: readErr.message };
    const currentVal = (current?.[field] || 0);
    const { error: writeErr } = await supabase
      .from('plan_generation_observability')
      .update({ [field]: currentVal + 1 })
      .eq('id', observabilityId);
    if (writeErr) return { ok: false, error: writeErr.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Update les compteurs anti-slop apres re-detection (ex: Anissa a accepte
 * une reformulation et le plan a moins de flags maintenant).
 *
 * @param {string} observabilityId
 * @param {Array} slopFlags - Output de detectSlopHeuristics sur le plan a jour
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function updateSlopFlagsCount(observabilityId, slopFlags) {
  if (!observabilityId) return { ok: false, error: 'id requis' };
  if (!Array.isArray(slopFlags)) return { ok: false, error: 'flags invalides' };

  const summary = summarizeSlopFlags(slopFlags);
  const byCategory = {};
  for (const s of summary) byCategory[s.category] = s.count;
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const f of slopFlags) {
    const sev = f.severity || 'low';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }

  try {
    const { error } = await supabase
      .from('plan_generation_observability')
      .update({
        slop_flags_count: slopFlags.length,
        slop_flags_by_category: byCategory,
        slop_flags_by_severity: bySeverity,
      })
      .eq('id', observabilityId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
