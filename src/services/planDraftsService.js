// ─── planDraftsService.js ────────────────────────────────────────────────
// V97.23 (V97.18 Phase E) — Service CRUD pour les brouillons IA en attente
// de validation par Anissa.
//
// Cf migration : V97.23_plan_drafts_pending_review.sql
// Cf chantier : V97.18 hybride templates par phase.

import { supabase, getCurrentUser } from '../supabaseClient';

/**
 * Cree un brouillon de plan en attente de validation.
 *
 * @param {object} args
 * @param {string} args.clientId
 * @param {string} args.draftText
 * @param {string} [args.sourceConsultationId]
 * @param {'auto_phase_transition'|'manual'|'other'} [args.source='other']
 * @param {object} [args.triggerMetadata]
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export async function createPlanDraft({
  clientId, draftText, sourceConsultationId,
  source = 'other', triggerMetadata = {},
}) {
  if (!clientId) return { ok: false, error: 'clientId requis' };
  if (!draftText || typeof draftText !== 'string') {
    return { ok: false, error: 'draftText requis' };
  }

  const row = {
    client_id: clientId,
    source_consultation_id: sourceConsultationId || null,
    draft_text: draftText,
    draft_length_chars: draftText.length,
    source,
    trigger_metadata: triggerMetadata,
    status: 'pending',
  };

  try {
    const { data, error } = await supabase
      .from('plan_drafts_pending_review')
      .insert(row)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Liste les drafts d'une cliente (ou tous si pas de clientId).
 *
 * @param {object} [opts]
 * @param {string} [opts.clientId]
 * @param {'pending'|'accepted'|'refused'|'expired'|'all'} [opts.status='pending']
 * @param {number} [opts.limit=50]
 */
export async function listPlanDrafts({ clientId, status = 'pending', limit = 50 } = {}) {
  try {
    let q = supabase
      .from('plan_drafts_pending_review')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);
    if (clientId) q = q.eq('client_id', clientId);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Recupere un draft par id.
 */
export async function getPlanDraft(id) {
  if (!id) return { ok: false, error: 'id requis' };
  try {
    const { data, error } = await supabase
      .from('plan_drafts_pending_review')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Marque un draft comme accepte. La conversion en consultation est faite
 * cote caller (Anissa peut vouloir editer avant d'enregistrer).
 *
 * @param {string} id
 * @param {string} [note]
 */
export async function acceptPlanDraft(id, note = null) {
  return _markReviewed(id, 'accepted', note);
}

/**
 * Marque un draft comme refuse.
 */
export async function refusePlanDraft(id, note = null) {
  return _markReviewed(id, 'refused', note);
}

async function _markReviewed(id, status, note) {
  if (!id) return { ok: false, error: 'id requis' };
  let reviewedBy = null;
  try {
    const user = await getCurrentUser();
    reviewedBy = user?.email || user?.id || null;
  } catch { /* noop */ }
  try {
    const { data, error } = await supabase
      .from('plan_drafts_pending_review')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        review_note: note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Compte les drafts pending pour une cliente (pour badge UI).
 */
export async function countPendingDrafts(clientId) {
  if (!clientId) return 0;
  try {
    const { count, error } = await supabase
      .from('plan_drafts_pending_review')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Compte global des drafts pending (toutes clientes confondues).
 */
export async function countAllPendingDrafts() {
  try {
    const { count, error } = await supabase
      .from('plan_drafts_pending_review')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}
