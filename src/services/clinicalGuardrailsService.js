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

import { supabase, getCurrentUser } from '../supabaseClient';
import { preloadGuardrailsFromSupabase } from './prompts/nutrition/_clinicalGuardrails.fr';

// V97.19.1 — Fields trackes dans l'audit log (memes que le whitelist update).
const TRACKED_FIELDS = ['display_name', 'forbidden_phrases', 'required_phrases',
  'micronutrients', 'evictions', 'precaution_vocab', 'enabled'];

/**
 * Calcule un diff minimal entre before et after sur les TRACKED_FIELDS.
 * Renvoie un objet { fieldName: { before, after } } limite aux fields changes.
 */
// V97.26 — exporte pour tests (logique pure testable, pattern reutilise
// dans phaseTemplatesService).
export function computeDiff(before, after) {
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
 * Met a jour un guardrail (par id) + ecrit un audit log si beforeState fourni.
 * Patch fields uniquement : pas besoin de tout passer.
 *
 * @param {string} id - UUID du guardrail
 * @param {object} patch - Fields a updater (display_name, forbidden_phrases,
 *   required_phrases, micronutrients, evictions, precaution_vocab, enabled)
 * @param {object} [beforeState] - L'etat AVANT modification (pour computer le diff
 *   et l'inscrire dans clinical_guardrails_audit). Optionnel (sans, pas de log).
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, auditLogged?: boolean }>}
 */
export async function updateGuardrail(id, patch, beforeState = null) {
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
      .from('clinical_guardrails')
      .update(cleanPatch)
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };

    // V97.19.1 — Audit log si beforeState fourni et qu'il y a au moins un changement.
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
            .from('clinical_guardrails_audit')
            .insert({
              guardrail_id: id,
              profile_key: data.profile_key,
              action: 'update',
              changed_by: changedBy,
              diff,
            });
          if (!auditError) auditLogged = true;
          // L'erreur audit n'est pas bloquante : on a deja update la regle principale
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[guardrails-audit] insert failed:', e?.message);
      }
    }

    // Invalide le cache pour que la prochaine generation utilise les nouvelles regles
    await preloadGuardrailsFromSupabase(supabase, { force: true });
    return { ok: true, data, auditLogged };
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
