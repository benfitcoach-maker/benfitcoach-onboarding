// ─── useSlopAudit.js ─────────────────────────────────────────────────────
// V97.27 (audit refacto) — Hook extrait de JourneyPlanEditor.jsx (~120 lignes
// inline → hook reusable + testable).
//
// Encapsule :
//   - state slopFlags / slopRunning / slopRewrites
//   - handler runAudit(planText) : detecte les flags + sync observability
//   - handler requestRewrite(flag, planText) : call Haiku + cache result
//   - handler acceptRewrite(flag, planText, onPlanChange) : replace ligne +
//     setResult + re-detect flags + track obs
//   - handler refuseRewrite(flag) : marque refused + track obs
//   - reset() : clear state (au regenerate)

import { useState } from 'react';
import { detectSlopHeuristics } from '../services/prompts/nutrition/_antiSlop.fr';
import { rewriteSlopSection, replaceLineInPlan } from '../services/rewriteSlopSection';
import { recordSlopAction, updateSlopFlagsCount } from '../services/planObservability';

/**
 * Hook anti-slop : detection + reformulation Haiku + telemetrie OBS-1.
 *
 * @param {{ observabilityId: string | null }} opts
 * @returns {{
 *   slopFlags: Array | null,
 *   slopRunning: boolean,
 *   slopRewrites: object,
 *   reset: () => void,
 *   runAudit: (planText: string) => void,
 *   requestRewrite: (flag: object, planText: string) => Promise<void>,
 *   acceptRewrite: (flag: object, planText: string, onPlanChange: (newPlan: string) => void) => void,
 *   refuseRewrite: (flag: object) => void,
 * }}
 */
export function useSlopAudit({ observabilityId }) {
  const [slopFlags, setSlopFlags] = useState(null);
  const [slopRunning, setSlopRunning] = useState(false);
  const [slopRewrites, setSlopRewrites] = useState({});

  const reset = () => {
    setSlopFlags(null);
    setSlopRunning(false);
    setSlopRewrites({});
  };

  const runAudit = (planText) => {
    setSlopRunning(true);
    // Synchrone mais wrap async pour permettre re-render avec spinner
    setTimeout(() => {
      try {
        const flags = detectSlopHeuristics(planText);
        setSlopFlags(flags);
        if (observabilityId) updateSlopFlagsCount(observabilityId, flags);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[anti-slop] failed:', e?.message);
        setSlopFlags([]);
      } finally {
        setSlopRunning(false);
      }
    }, 30);
  };

  const requestRewrite = async (flag, planText) => {
    const lines = (planText || '').split('\n');
    const passage = lines[flag.lineIndex] || flag.snippet || '';
    if (!passage.trim()) return;
    if (observabilityId) recordSlopAction(observabilityId, 'requested');
    setSlopRewrites((prev) => ({
      ...prev,
      [flag.id]: { status: 'loading' },
    }));
    try {
      const res = await rewriteSlopSection({ passage, flags: [flag] });
      if (res.ok && res.rewritten) {
        setSlopRewrites((prev) => ({
          ...prev,
          [flag.id]: { status: 'ready', text: res.rewritten, original: passage },
        }));
      } else {
        setSlopRewrites((prev) => ({
          ...prev,
          [flag.id]: { status: 'error', error: res.error || 'reformulation impossible' },
        }));
      }
    } catch (e) {
      setSlopRewrites((prev) => ({
        ...prev,
        [flag.id]: { status: 'error', error: e?.message || 'erreur' },
      }));
    }
  };

  const acceptRewrite = (flag, planText, onPlanChange) => {
    const entry = slopRewrites[flag.id];
    if (!entry || entry.status !== 'ready' || !entry.text) return;
    const newPlan = replaceLineInPlan(planText, flag.lineIndex, entry.text);
    onPlanChange(newPlan);
    setSlopRewrites((prev) => ({
      ...prev,
      [flag.id]: { ...entry, status: 'accepted' },
    }));
    if (observabilityId) recordSlopAction(observabilityId, 'accepted');
    // Re-detecte les flags sur le plan modifie (la ligne flaggee peut etre clean maintenant)
    try {
      const refreshed = detectSlopHeuristics(newPlan);
      setSlopFlags(refreshed);
      if (observabilityId) updateSlopFlagsCount(observabilityId, refreshed);
    } catch { /* noop */ }
  };

  const refuseRewrite = (flag) => {
    setSlopRewrites((prev) => ({
      ...prev,
      [flag.id]: { ...(prev[flag.id] || {}), status: 'refused' },
    }));
    if (observabilityId) recordSlopAction(observabilityId, 'refused');
  };

  return {
    slopFlags,
    slopRunning,
    slopRewrites,
    reset,
    runAudit,
    requestRewrite,
    acceptRewrite,
    refuseRewrite,
  };
}
