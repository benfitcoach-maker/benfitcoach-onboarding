// ─── phaseTemplatesService.js ────────────────────────────────────────────
// V97.22 — Service CRUD pour le cockpit UI des recommandations par phase.
//
// Cf chantier : V97.18 hybride templates par phase (Phase A : data + UI).
// Cf table : phase_recommendations (migration V97.22 + seed V97.22.1).
//
// Architecture similaire a clinicalGuardrailsService :
//   - list / update + audit log automatique (diff before/after)
//   - Pas de create/delete UI : le seed cree les phases, Anissa toggle enabled.

import { supabase, getCurrentUser } from '../supabaseClient';

const TRACKED_FIELDS = [
  'client_name', 'clinical_name',
  'foods_favor', 'foods_limit', 'cooking', 'cooking_avoid',
  'supplements', 'clinical_notes', 'enabled',
];

function computeDiff(before, after) {
  const diff = {};
  if (!before || !after) return diff;
  for (const key of TRACKED_FIELDS) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return diff;
}

/**
 * Liste toutes les recommandations par phase, tries par template puis ordre.
 *
 * @returns {Promise<{ ok: boolean, data?: Array, error?: string }>}
 */
export async function listPhaseRecommendations() {
  try {
    const { data, error } = await supabase
      .from('phase_recommendations')
      .select('*')
      .order('template_key', { ascending: true })
      .order('phase_order', { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Met a jour une recommandation phase (par id) + ecrit audit log si beforeState.
 *
 * @param {string} id
 * @param {object} patch
 * @param {object} [beforeState]
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, auditLogged?: boolean }>}
 */
export async function updatePhaseRecommendation(id, patch, beforeState = null) {
  if (!id) return { ok: false, error: 'id manquant' };
  if (!patch || typeof patch !== 'object') return { ok: false, error: 'patch invalide' };

  const cleanPatch = {};
  for (const key of TRACKED_FIELDS) {
    if (key in patch) cleanPatch[key] = patch[key];
  }
  if (Object.keys(cleanPatch).length === 0) {
    return { ok: false, error: 'aucun field editable' };
  }
  cleanPatch.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('phase_recommendations')
      .update(cleanPatch)
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };

    let auditLogged = false;
    if (beforeState) {
      try {
        const diff = computeDiff(beforeState, data);
        if (Object.keys(diff).length > 0) {
          let changedBy = null;
          try {
            const user = await getCurrentUser();
            changedBy = user?.email || user?.id || null;
          } catch { /* noop */ }
          const { error: auditError } = await supabase
            .from('phase_recommendations_audit')
            .insert({
              recommendation_id: id,
              template_key: data.template_key,
              phase_id: data.phase_id,
              action: 'update',
              changed_by: changedBy,
              diff,
            });
          if (!auditError) auditLogged = true;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[phase-reco-audit] insert failed:', e?.message);
      }
    }

    return { ok: true, data, auditLogged };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Liste les N dernieres entrees de l'audit log.
 *
 * @param {number} [limit=20]
 */
export async function listPhaseRecoAuditLog(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('phase_recommendations_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
