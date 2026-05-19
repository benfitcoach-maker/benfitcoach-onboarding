// ─── useGuardrailsAudit.js ───────────────────────────────────────────────
// V97.27 (audit refacto) — Hook extrait de JourneyPlanEditor.jsx.
//
// Encapsule :
//   - state guardrailsState ({ guardrails, violations, completeness })
//   - ref synchrone pour eviter race avec recordPlanGeneration (HIGH-2)
//   - preload DB au mount (avec fallback hardcode silencieux)
//   - setActiveGuardrails() : appele quand le composer beta detecte des guardrails
//   - runAudit(planText) : detecte violations + completeness, met a jour state
//   - reset() : clear state (au regenerate)
//
// Le pre-existing bug HIGH-2 (race condition setState callback vs lecture
// synchrone par recordPlanGeneration) reste resolu via la ref interne.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  auditPlanForGuardrails,
  auditPlanCompleteness,
  preloadGuardrailsFromSupabase,
} from '../services/prompts/nutrition/_clinicalGuardrails.fr';

/**
 * Hook audit clinique (guardrails).
 *
 * @param {{ supabase: object }} opts - Supabase client pour preload.
 * @returns {{
 *   guardrailsState: object | null,
 *   reset: () => void,
 *   setActiveGuardrails: (guardrails: Array) => void,
 *   runAudit: (planText: string) => { violations: Array, completeness: object, guardrails: Array },
 * }}
 */
export function useGuardrailsAudit({ supabase }) {
  const [guardrailsState, setGuardrailsState] = useState(null);
  // Ref pour lecture synchrone : evite race condition setState callback
  // microtask vs recordPlanGeneration synchrone (audit V97.25 HIGH-2 fix).
  const guardrailsStateRef = useRef(null);
  useEffect(() => { guardrailsStateRef.current = guardrailsState; }, [guardrailsState]);

  // Preload DB au mount. Fallback silencieux sur hardcode si DB down.
  useEffect(() => {
    if (!supabase) return;
    preloadGuardrailsFromSupabase(supabase).then((res) => {
      if (res.ok) {
        // eslint-disable-next-line no-console
        console.log(`[guardrails] preload OK from ${res.source} (${res.count} profils)`);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[guardrails] preload fallback to hardcode: ${res.error}`);
      }
    });
  }, [supabase]);

  const reset = useCallback(() => {
    setGuardrailsState(null);
  }, []);

  const setActiveGuardrails = useCallback((guardrails) => {
    if (Array.isArray(guardrails) && guardrails.length > 0) {
      setGuardrailsState({ guardrails, violations: [], completeness: null });
    }
  }, []);

  /**
   * Compute SYNCHRONE : retourne les valeurs calculees + update state.
   * Le caller peut utiliser le retour directement (pas besoin d'attendre
   * que React execute le setState callback).
   */
  const runAudit = useCallback((planText) => {
    const empty = { violations: [], completeness: null, guardrails: [] };
    try {
      const currentGuardrails = guardrailsStateRef.current?.guardrails || [];
      if (currentGuardrails.length === 0) return empty;
      const violations = auditPlanForGuardrails(planText, currentGuardrails);
      const completeness = auditPlanCompleteness(planText, currentGuardrails);
      setGuardrailsState((prev) => prev?.guardrails?.length
        ? { ...prev, violations, completeness }
        : prev);
      return { violations, completeness, guardrails: currentGuardrails };
    } catch (auditErr) {
      // eslint-disable-next-line no-console
      console.warn('[guardrails-audit] post-generation failed (non-bloquant):', auditErr?.message);
      return empty;
    }
  }, []);

  return {
    guardrailsState,
    reset,
    setActiveGuardrails,
    runAudit,
  };
}
