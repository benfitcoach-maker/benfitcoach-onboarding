// ─── autoGeneratePlanForPhaseTransition.js ───────────────────────────────
// V97.23 (V97.18 Phase E) — Orchestrateur de generation auto IA d'un
// brouillon de plan apres transition de phase.
//
// Cf migration : V97.23_plan_drafts_pending_review.sql
// Cf service : planDraftsService.js
// Cf composer : services/prompts/nutrition/composer.fr.js (Phase D injection)
//
// Flow :
//   1. Anissa termine une consultation + clique "Phase suivante"
//   2. Apres transitionToNextPhase + handleSavePhases (cote caller),
//      le caller appelle autoGeneratePlanForPhaseTransition
//   3. Le orchestrator :
//      - Construit le prompt via composer (Phase D inject activePhase)
//      - Call Claude Sonnet (best-effort, gros maxTokens)
//      - Stocke le brouillon dans plan_drafts_pending_review
//   4. Phase F (UI) : Anissa voit le badge "1 brouillon a valider",
//      ouvre, edit si besoin, accept (→ consultation) ou refuse.
//
// Fire-and-forget : ne bloque PAS le flow principal. Si echec, log warn
// et stocke quand meme une trace via metadata.error (Phase F UI peut afficher).

import { callClaude } from './anthropic';
import { buildSystemPromptFrV2 } from './prompts/nutrition/fr';
import { buildClinicalContext } from './clinical/buildClinicalContext';
import { createPlanDraft } from './planDraftsService';
import { assertPlanClinicallyCleared } from './clinicalClearance';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Genere un brouillon de plan IA pour la nouvelle phase active et le
 * stocke dans plan_drafts_pending_review.
 *
 * @param {object} args
 * @param {object} args.client - Cliente complete (form, journey_state, etc.)
 * @param {string} args.fromPhaseId - id de la phase qu'on vient de quitter
 * @param {string} args.toPhaseId - id de la nouvelle phase active
 * @param {string} args.templateKey - 'microbiote_5_phases' etc.
 * @param {number} [args.weekNumber=1] - Semaine 1 par defaut a la transition
 * @param {string} [args.sourceConsultationId]
 * @param {string} [args.model]
 * @returns {Promise<{ ok: boolean, draftId?: string, error?: string }>}
 */
export async function autoGeneratePlanForPhaseTransition(args) {
  const {
    client, fromPhaseId, toPhaseId, templateKey,
    weekNumber = 1, sourceConsultationId, model = DEFAULT_MODEL,
  } = args;

  if (!client?.id) return { ok: false, error: 'client requis' };
  if (!templateKey || !toPhaseId) return { ok: false, error: 'templateKey + toPhaseId requis' };

  const startedAt = Date.now();
  const form = client.form || {};
  const planMode = form.consultationType === 'oneshot' ? 'oneshot' : 'followup';

  // Build clinicalContext (best-effort)
  let clinicalContext = null;
  try {
    clinicalContext = buildClinicalContext({
      journeyState: client?.journey_state,
      form,
    });
  } catch { clinicalContext = null; }

  const opts = {
    isFollowup: planMode === 'followup',
    clientFormule: client.formule || 'nutrition',
    followupWeek: 0,
    planMode,
    activePhase: {
      templateKey,
      phaseId: toPhaseId,
      weekNumber,
    },
  };

  try {
    const v2 = buildSystemPromptFrV2(form, opts, { useComposer: true, clinicalContext });
    if (v2.blocked) {
      return { ok: false, error: `composer blocked: ${v2.profile?.blockReason || 'profil non supporté'}` };
    }
    const userMsg = `Génère le nouveau plan nutritionnel pour ${form?.prenom || 'la cliente'} qui démarre la phase "${toPhaseId}" de son parcours. Aligne strictement le plan sur les recommandations de la phase active fournie dans le system prompt.`;
    const res = await callClaude({
      system: v2.prompt,
      user: userMsg,
      model,
      maxTokens: 16000,
    });
    const draftText = typeof res === 'string' ? res : (res?.text || '');
    if (!draftText) return { ok: false, error: 'reponse Claude vide' };

    // P1.3 (remède sécurité clinique) — clairance clinique IMMÉDIATEMENT après
    // génération. Le verdict est stocké dans trigger_metadata (JSONB, pas de
    // migration : la table V97.23 prévoit déjà cette extensibilité) pour que
    // PendingDraftsPanel l'affiche → Anissa ne valide plus sur texte aveugle.
    // Le gate dur reste la re-vérification live à la publication (P1.2).
    let clinicalClearance = null;
    try {
      const verdict = assertPlanClinicallyCleared(draftText, {
        form,
        guardrails: v2.guardrails,
      });
      clinicalClearance = {
        cleared: verdict.cleared,
        severity: verdict.severity,
        violations: verdict.violations,
        warnings: verdict.warnings,
        evaluated_at: new Date().toISOString(),
      };
    } catch {
      // FAIL-CLOSED : clairance impossible = marquée bloquante, jamais omise.
      clinicalClearance = {
        cleared: false,
        severity: 'high',
        violations: [{ type: 'clearance_error', severity: 'high', label: 'Clairance impossible à la génération — à revoir cliniquement.' }],
        warnings: [],
        evaluated_at: new Date().toISOString(),
      };
    }

    const generationDurationMs = Date.now() - startedAt;
    const saveRes = await createPlanDraft({
      clientId: client.id,
      sourceConsultationId,
      draftText,
      source: 'auto_phase_transition',
      triggerMetadata: {
        from_phase_id: fromPhaseId,
        to_phase_id: toPhaseId,
        template_key: templateKey,
        week_number: weekNumber,
        generation_duration_ms: generationDurationMs,
        model,
        profile_tag: v2.profile?.tag || null,
        guardrails_applied: (v2.guardrails || []).map((g) => g.profile_key),
        phase_recommendations_source: v2.phaseRecommendations?.source || null,
        clinical_clearance: clinicalClearance,
      },
    });
    if (!saveRes.ok) {
      return { ok: false, error: `save failed: ${saveRes.error}` };
    }
    return { ok: true, draftId: saveRes.data?.id };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[auto-gen-phase] failed:', e?.message);
    return { ok: false, error: e?.message || String(e) };
  }
}
