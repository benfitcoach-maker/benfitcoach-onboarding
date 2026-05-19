// ─── usePlanAutosave.js ──────────────────────────────────────────────────
// V97.27 (audit refacto) — Hook extrait de JourneyPlanEditor.jsx.
//
// Encapsule le pattern autosave debouncé :
//   - state autosaveState : 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
//   - ref autosaveTimerRef (timeout id du debounce 1.5s)
//   - ref lastSavedTextRef (derniere version sauvee, evite double-save)
//   - effect schedule onSave a chaque changement de planText (debounce)
//   - markSaving / markSaved / markError exposes au caller
//   - markInitial(text) appelle au load initial pour seed lastSavedTextRef

import { useState, useEffect, useRef, useCallback } from 'react';

const DEBOUNCE_MS = 1500;
const SAVED_FLASH_MS = 1800;

/**
 * Hook autosave debouncé.
 *
 * @param {{ planText: string, loadingInitial: boolean, onSave: () => Promise<void> }} opts
 * @returns {{
 *   autosaveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error',
 *   markSaving: () => void,
 *   markSaved: (text: string) => void,
 *   markError: () => void,
 *   markInitial: (text: string) => void,
 * }}
 */
export function usePlanAutosave({ planText, loadingInitial, onSave }) {
  const [autosaveState, setAutosaveState] = useState('idle');
  const autosaveTimerRef = useRef(null);
  const lastSavedTextRef = useRef('');

  // Schedule debounced save on planText change
  useEffect(() => {
    if (loadingInitial) return;
    if (planText === lastSavedTextRef.current) return;
    setAutosaveState('dirty');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      onSave();
    }, DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [planText, loadingInitial, onSave]);

  // Initialise lastSavedTextRef au premier load (evite autosave inutile)
  useEffect(() => {
    if (!loadingInitial && lastSavedTextRef.current === '' && planText) {
      lastSavedTextRef.current = planText;
    }
  }, [loadingInitial, planText]);

  const markSaving = useCallback(() => {
    setAutosaveState('saving');
  }, []);

  const markSaved = useCallback((text) => {
    lastSavedTextRef.current = text;
    setAutosaveState('saved');
    setTimeout(() => {
      setAutosaveState((s) => (s === 'saved' ? 'idle' : s));
    }, SAVED_FLASH_MS);
  }, []);

  const markError = useCallback(() => {
    setAutosaveState('error');
  }, []);

  const markInitial = useCallback((text) => {
    lastSavedTextRef.current = text;
  }, []);

  return {
    autosaveState,
    markSaving,
    markSaved,
    markError,
    markInitial,
  };
}
