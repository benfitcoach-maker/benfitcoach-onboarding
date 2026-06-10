// P2.1 (remède sécurité clinique, 2026-06-10) — propagation de l'état réel
// (panne vs vide) jusqu'aux composants de signal du cockpit Suivi.
//
// Invariant clé (type C bien soigné) : le SILENCE n'est un mensonge QUE sous
// panne. Un cockpit qui reçoit feedbacks=[] ne doit pas affirmer « cliente vient
// de démarrer » quand la cause est un fetch échoué — mais doit garder cette
// phrase quand la synchro a réussi et qu'il n'y a réellement rien. On distingue
// donc 4 états d'affichage, source de vérité UNIQUE consultée par les 3+ sites.
//
// Précédence : loading > sync_error > empty > data. Pendant le chargement
// initial, aucun site ne doit afficher la phrase rassurante par défaut.
//
// Test ROUGE avant remède (signalDisplayState n'existe pas) → VERT après.

import { describe, it, expect } from 'vitest';
import { signalDisplayState } from '../signalDisplayState';

describe('signalDisplayState — état réel propagé (P2.1)', () => {
  it('chargement en cours → loading (jamais la phrase rassurante)', () => {
    expect(signalDisplayState({ loading: true, syncError: false, count: 0 })).toBe('loading');
    // loading l'emporte même si on a déjà des données ou une panne résiduelle
    expect(signalDisplayState({ loading: true, syncError: true, count: 0 })).toBe('loading');
    expect(signalDisplayState({ loading: true, syncError: false, count: 5 })).toBe('loading');
  });

  it('panne synchro (hors chargement) → sync_error, distinct du vide réel', () => {
    expect(signalDisplayState({ loading: false, syncError: true, count: 0 })).toBe('sync_error');
    // panne prime sur un éventuel count résiduel
    expect(signalDisplayState({ loading: false, syncError: true, count: 3 })).toBe('sync_error');
  });

  it('synchro OK, zéro donnée → empty (vide réel : la phrase rassurante est vraie)', () => {
    expect(signalDisplayState({ loading: false, syncError: false, count: 0 })).toBe('empty');
  });

  it('synchro OK, données présentes → data', () => {
    expect(signalDisplayState({ loading: false, syncError: false, count: 1 })).toBe('data');
    expect(signalDisplayState({ loading: false, syncError: false, count: 42 })).toBe('data');
  });

  it('count absent / non numérique → traité comme vide (jamais data par défaut)', () => {
    expect(signalDisplayState({ loading: false, syncError: false })).toBe('empty');
    expect(signalDisplayState({ loading: false, syncError: false, count: undefined })).toBe('empty');
  });

  it('argument manquant → empty (défaut conservateur, jamais throw)', () => {
    expect(() => signalDisplayState()).not.toThrow();
    expect(signalDisplayState()).toBe('empty');
  });
});
