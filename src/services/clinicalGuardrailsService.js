// ─── clinicalGuardrailsService.js ───────────────────────────────────────
// V97.19 — Service CRUD pour le cockpit UI de gestion des garde-fous.
//
// Cf spec : spec-composer-v97-clinical-antislop.md (Phase 5)
// Cf table : clinical_guardrails (migrations V97.18, seed V97.18.1)
// Cf policy : V97.18.3 (UPDATE authenticated)
//
// API minimaliste : list + update + (audit log read en bonus).
// Pas de create/delete : les 7 profils sont figes cote code (cf
// detectClinicalGuardrails dans _clinicalGuardrails.fr.js).

import { supabase } from '../supabaseClient';
import { preloadGuardrailsFromSupabase } from './prompts/nutrition/_clinicalGuardrails.fr';

/**
 * Liste tous les guardrails depuis la DB (enabled + disabled).
 * Utilise pour la vue cockpit (Anissa veut voir aussi les desactives).
 *
 * @returns {Promise<{ ok: boolean, data?: Array, error?: string }>}
 */
export async function listAllGuardrails() {
  try {
    const { data, error } = await supabase
      .from('clinical_guardrails')
      .select('*')
      .order('profile_key', { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Met a jour un guardrail (par id).
 * Patch fields uniquement : pas besoin de tout passer.
 *
 * @param {string} id - UUID du guardrail
 * @param {object} patch - Fields a updater (display_name, forbidden_phrases,
 *   required_phrases, micronutrients, evictions, precaution_vocab, enabled)
 * @returns {Promise<{ ok: boolean, data?: object, error?: string }>}
 */
export async function updateGuardrail(id, patch) {
  if (!id) return { ok: false, error: 'id manquant' };
  if (!patch || typeof patch !== 'object') return { ok: false, error: 'patch invalide' };

  // Whitelist des fields editables
  const editable = ['display_name', 'forbidden_phrases', 'required_phrases',
    'micronutrients', 'evictions', 'precaution_vocab', 'enabled'];
  const cleanPatch = {};
  for (const key of editable) {
    if (key in patch) cleanPatch[key] = patch[key];
  }
  if (Object.keys(cleanPatch).length === 0) {
    return { ok: false, error: 'aucun field editable' };
  }
  cleanPatch.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('clinical_guardrails')
      .update(cleanPatch)
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    // Invalide le cache pour que la prochaine generation utilise les nouvelles regles
    await preloadGuardrailsFromSupabase(supabase, { force: true });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Liste les N dernieres entrees de l'audit log.
 * Utile pour traquer qui a modifie quoi (debug, compliance).
 *
 * @param {number} [limit=20]
 * @returns {Promise<{ ok: boolean, data?: Array, error?: string }>}
 */
export async function listAuditLog(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('clinical_guardrails_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
