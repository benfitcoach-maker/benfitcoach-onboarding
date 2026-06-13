// Fondation anamnèse V1 (2026-06-13) — lecteurs structurels neutres.

import { describe, it, expect } from 'vitest';
import {
  formatComplementsActuels,
  OUVERTURE_COMPLEMENTS,
  resolveOuvertureComplements,
} from '../anamneseFoundation';

describe('formatComplementsActuels', () => {
  it('Formate nom + dose', () => {
    const s = formatComplementsActuels({
      complementsActuels: [
        { nom: 'Vitamine D', dose: '1000 UI' },
        { nom: 'Magnésium', dose: '300 mg' },
      ],
    });
    expect(s).toBe('Vitamine D (1000 UI), Magnésium (300 mg)');
  });

  it('Tolère une dose absente', () => {
    expect(formatComplementsActuels({ complementsActuels: [{ nom: 'Oméga-3' }] })).toBe('Oméga-3');
  });

  it('Ignore les lignes sans nom', () => {
    const s = formatComplementsActuels({ complementsActuels: [{ dose: '500 mg' }, { nom: 'Fer' }] });
    expect(s).toBe('Fer');
  });

  it('Fail-safe : vide / null / mauvais type', () => {
    expect(formatComplementsActuels(null)).toBe('');
    expect(formatComplementsActuels({})).toBe('');
    expect(formatComplementsActuels({ complementsActuels: [] })).toBe('');
  });
});

describe('OUVERTURE_COMPLEMENTS — libellés exacts validés Anissa', () => {
  it('Porte les 3 libellés exacts', () => {
    expect(OUVERTURE_COMPLEMENTS.eviter).toBe('Je préfère éviter les compléments');
    expect(OUVERTURE_COMPLEMENTS.si_necessaire).toBe('Je suis ouverte si nécessaire');
    expect(OUVERTURE_COMPLEMENTS.a_laise).toBe('Je suis à l\'aise avec les compléments');
  });
});

describe('resolveOuvertureComplements', () => {
  it('Résout par code canonique', () => {
    expect(resolveOuvertureComplements({ ouvertureComplements: 'eviter' })).toBe('eviter');
  });

  it('Résout par libellé complet', () => {
    expect(resolveOuvertureComplements({ ouvertureComplements: 'Je suis à l\'aise avec les compléments' })).toBe('a_laise');
  });

  it('Fail-safe : vide / inconnu / null', () => {
    expect(resolveOuvertureComplements({ ouvertureComplements: '' })).toBeNull();
    expect(resolveOuvertureComplements({ ouvertureComplements: 'bof' })).toBeNull();
    expect(resolveOuvertureComplements(null)).toBeNull();
  });
});
