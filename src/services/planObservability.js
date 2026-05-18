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

// V97.21 (OBS-2) — Helpers de lecture pour le dashboard stats.

/**
 * Liste les rows d'observability filtrees par fenetre temporelle.
 *
 * @param {object} [opts]
 * @param {number} [opts.daysBack=30]
 * @param {number} [opts.limit=500]
 * @returns {Promise<{ ok: boolean, data?: Array, error?: string }>}
 */
export async function listObservability({ daysBack = 30, limit = 500 } = {}) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase
      .from('plan_generation_observability')
      .select('*')
      .gte('generated_at', since)
      .order('generated_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Aggregations cote client pour le dashboard.
 * Pour V1, on garde simple : pas de RPC SQL.
 *
 * @param {Array} rows - Output de listObservability
 * @returns {object} Stats agrégées
 */
export function aggregateObservability(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      total: 0,
      composerBetaRatio: 0,
      avgViolations: 0,
      avgSlopFlags: 0,
      avgPlanLength: 0,
      haikuAcceptRate: null,
      haikuRequested: 0,
      haikuAccepted: 0,
      haikuRefused: 0,
      generationsByWeek: [],
      topGuardrails: [],
      topMissingProfiles: [],
      topSlopCategories: [],
    };
  }

  const total = rows.length;
  const composerBetaCount = rows.filter((r) => r.composer_beta).length;
  const sumViolations = rows.reduce((a, r) => a + (r.violations_count || 0), 0);
  const sumSlop = rows.reduce((a, r) => a + (r.slop_flags_count || 0), 0);
  const sumLen = rows.reduce((a, r) => a + (r.plan_length_chars || 0), 0);
  const haikuReq = rows.reduce((a, r) => a + (r.slop_rewrites_requested_count || 0), 0);
  const haikuAcc = rows.reduce((a, r) => a + (r.slop_rewrites_accepted_count || 0), 0);
  const haikuRef = rows.reduce((a, r) => a + (r.slop_rewrites_refused_count || 0), 0);

  // Generations par semaine (lundi ISO)
  const byWeek = new Map();
  for (const r of rows) {
    if (!r.generated_at) continue;
    const d = new Date(r.generated_at);
    const monday = new Date(d);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    byWeek.set(key, (byWeek.get(key) || 0) + 1);
  }
  const generationsByWeek = Array.from(byWeek.entries())
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Top guardrails actifs
  const guardrailCounts = new Map();
  for (const r of rows) {
    for (const key of r.guardrails_applied || []) {
      guardrailCounts.set(key, (guardrailCounts.get(key) || 0) + 1);
    }
  }
  const topGuardrails = Array.from(guardrailCounts.entries())
    .map(([profile_key, count]) => ({ profile_key, count }))
    .sort((a, b) => b.count - a.count);

  // Profils avec micros/evictions manquantes
  const missingByProfile = new Map();
  for (const r of rows) {
    const m = (r.missing_micronutrients_count || 0) + (r.missing_evictions_count || 0);
    if (m > 0) {
      for (const key of r.guardrails_applied || []) {
        const cur = missingByProfile.get(key) || { gens: 0, totalMissing: 0 };
        cur.gens += 1;
        cur.totalMissing += m;
        missingByProfile.set(key, cur);
      }
    }
  }
  const topMissingProfiles = Array.from(missingByProfile.entries())
    .map(([profile_key, v]) => ({
      profile_key,
      gens: v.gens,
      avgMissing: v.gens > 0 ? (v.totalMissing / v.gens) : 0,
    }))
    .sort((a, b) => b.gens - a.gens);

  // Top categories anti-slop
  const slopCatCounts = new Map();
  for (const r of rows) {
    const cat = r.slop_flags_by_category || {};
    for (const [k, v] of Object.entries(cat)) {
      slopCatCounts.set(k, (slopCatCounts.get(k) || 0) + (v || 0));
    }
  }
  const topSlopCategories = Array.from(slopCatCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    composerBetaRatio: total > 0 ? composerBetaCount / total : 0,
    avgViolations: total > 0 ? sumViolations / total : 0,
    avgSlopFlags: total > 0 ? sumSlop / total : 0,
    avgPlanLength: total > 0 ? sumLen / total : 0,
    haikuRequested: haikuReq,
    haikuAccepted: haikuAcc,
    haikuRefused: haikuRef,
    haikuAcceptRate: haikuReq > 0 ? haikuAcc / haikuReq : null,
    generationsByWeek,
    topGuardrails,
    topMissingProfiles,
    topSlopCategories,
  };
}

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
 * Increment ATOMIQUE d'un compteur d'action slop sur une row.
 *
 * V97.25 (audit HIGH fix) — remplace l'ancien read-modify-write JS qui
 * perdait des increments en cas d'accept Haiku quasi-simultanes. La RPC
 * obs_increment_field (cf migrations/V97.25_obs_increment_rpc.sql) fait
 * UPDATE inline col = col + 1.
 *
 * @param {string} observabilityId - id retourne par recordPlanGeneration
 * @param {'requested'|'accepted'|'refused'} action
 * @returns {Promise<{ ok: boolean, newCount?: number, error?: string }>}
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
    const { data, error } = await supabase.rpc('obs_increment_field', {
      p_id: observabilityId,
      p_field: field,
    });
    if (error) {
      // Fallback : si la RPC n'est pas encore appliquee en DB (migration
      // V97.25 pas runee), on tombe sur l'ancien comportement read-modify-write
      // pour ne pas casser la prod. Log warn pour signaler.
      // eslint-disable-next-line no-console
      console.warn('[obs-increment-rpc] failed, fallback read-modify-write:', error.message);
      return await _recordSlopActionFallback(observabilityId, field);
    }
    return { ok: true, newCount: data?.new_count };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Fallback non-atomique (pre V97.25 migration). Identique a l'ancien code,
 * conserve uniquement le temps que la migration soit appliquee en prod.
 */
async function _recordSlopActionFallback(observabilityId, field) {
  try {
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
    return { ok: true, newCount: currentVal + 1, fallback: true };
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
