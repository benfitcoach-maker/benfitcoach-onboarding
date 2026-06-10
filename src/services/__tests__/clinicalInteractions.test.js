// V1 FIGÉE (validé Anissa le 2026-06-10, réf. docs/VALIDATION-CLINIQUE-ANISSA-V1.md).
//
// On teste la fonction pure classifyInteraction — la DÉCISION clinique est une
// donnée révisable par Anissa (INTERACTION_CLASSIFICATION), pas codée par un
// non-clinicien. Trois nature : 'blocking' inconditionnel, 'advisory', et
// CONDITIONNELLE (advisory par défaut, 'blocking' si traitement ciblé actif).

import { describe, it, expect } from 'vitest';
import { classifyInteraction } from '../clinicalInteractions';

// Helpers : map detectTreatments minimale (seul `active` est lu pour l'escalade).
const withActive = (...keys) =>
  keys.reduce((acc, k) => ({ ...acc, [k]: { active: true } }), {});

describe('classifyInteraction — bloquant inconditionnel', () => {
  it('millepertuis → blocking quel que soit le contexte', () => {
    expect(classifyInteraction('Millepertuis')).toBe('blocking');
    expect(classifyInteraction('Millepertuis', withActive('avk'))).toBe('blocking');
  });

  it('pamplemousse → blocking', () => {
    expect(classifyInteraction('Pamplemousse')).toBe('blocking');
  });
});

describe('classifyInteraction — portée vitamine K2 (D1-B)', () => {
  it('K2 forte dose → blocking (clé spécifique prioritaire)', () => {
    expect(classifyInteraction('Vitamine K2 forte dose')).toBe('blocking');
  });

  it('K2 dose normale → advisory (clé générique, ne bloque pas tout K2)', () => {
    expect(classifyInteraction('Vitamine K2')).toBe('advisory');
    expect(classifyInteraction('Vitamine K2 dose normale')).toBe('advisory');
  });
});

describe('classifyInteraction — conditionnel oméga-3 (D1-A)', () => {
  it('advisory en population générale (aucun traitement)', () => {
    expect(classifyInteraction('Omega-3 forte dose (>3g)')).toBe('advisory');
    expect(classifyInteraction('Omega-3 forte dose (>3g)', {})).toBe('advisory');
  });

  it('blocking si AVK actif', () => {
    expect(classifyInteraction('Omega-3 forte dose (>3g)', withActive('avk'))).toBe('blocking');
  });

  it('blocking si AOD (doac) actif', () => {
    expect(classifyInteraction('Omega-3 forte dose (>3g)', withActive('doac'))).toBe('blocking');
  });

  it('reste advisory si un AUTRE traitement (non ciblé) est actif', () => {
    expect(classifyInteraction('Omega-3 forte dose (>3g)', withActive('levothyrox'))).toBe('advisory');
  });
});

describe('classifyInteraction — conditionnel berbérine (D1-A)', () => {
  it('advisory en population générale', () => {
    expect(classifyInteraction('Berberine')).toBe('advisory');
  });

  it('blocking si insuline active', () => {
    expect(classifyInteraction('Berberine', withActive('insuline'))).toBe('blocking');
  });

  it('blocking si metformine active', () => {
    expect(classifyInteraction('Berberine', withActive('metformine'))).toBe('blocking');
  });
});

describe('classifyInteraction — chrome plat (D1-C)', () => {
  it('advisory même sous insuline (PAS d\'escalade bloquante)', () => {
    expect(classifyInteraction('Chrome')).toBe('advisory');
    expect(classifyInteraction('Chrome', withActive('insuline'))).toBe('advisory');
  });
});

describe('classifyInteraction — fail-closed', () => {
  it('substance non listée → needs_review', () => {
    expect(classifyInteraction('Cannelle (potentialise)')).toBe('needs_review');
  });

  it('entrée vide / illisible → needs_review', () => {
    expect(classifyInteraction('')).toBe('needs_review');
    expect(classifyInteraction(null)).toBe('needs_review');
    expect(classifyInteraction(undefined)).toBe('needs_review');
  });
});
