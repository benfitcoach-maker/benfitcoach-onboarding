// Fondation anamnèse V1 (2026-06-13) — couche données restrictions.
// Prouve la classification (3 natures distinctes) et le résolveur structurel.

import { describe, it, expect } from 'vitest';
import {
  RESTRICTIONS_MAP,
  RESTRICTION_PRIORITY,
  resolveRestrictions,
  hasRestrictions,
} from '../restrictions.fr';

describe('RESTRICTIONS_MAP — classification figée Anissa', () => {
  it('Halal et Casher = religieux', () => {
    expect(RESTRICTIONS_MAP.halal.priorite).toBe(RESTRICTION_PRIORITY.RELIGIOUS);
    expect(RESTRICTIONS_MAP.casher.priorite).toBe(RESTRICTION_PRIORITY.RELIGIOUS);
  });

  it('Ramadan = timing (PAS religieux — nature différente)', () => {
    expect(RESTRICTIONS_MAP.ramadan.priorite).toBe(RESTRICTION_PRIORITY.TIMING);
    expect(RESTRICTIONS_MAP.ramadan.priorite).not.toBe(RESTRICTION_PRIORITY.RELIGIOUS);
  });

  it('Végétarien, Végan, Autre = preference', () => {
    expect(RESTRICTIONS_MAP.vegetarien.priorite).toBe(RESTRICTION_PRIORITY.PREFERENCE);
    expect(RESTRICTIONS_MAP.vegan.priorite).toBe(RESTRICTION_PRIORITY.PREFERENCE);
    expect(RESTRICTIONS_MAP.autre.priorite).toBe(RESTRICTION_PRIORITY.PREFERENCE);
  });

  it('Porte des libellés FR et EN pour chaque catégorie', () => {
    for (const code of Object.keys(RESTRICTIONS_MAP)) {
      expect(RESTRICTIONS_MAP[code].label).toBeTruthy();
      expect(RESTRICTIONS_MAP[code].labelEn).toBeTruthy();
    }
  });
});

describe('resolveRestrictions — résolveur structurel', () => {
  it('Groupe les codes par priorité', () => {
    const r = resolveRestrictions({ restrictionsAlimentaires: ['halal', 'vegan', 'ramadan'] });
    expect(r.religieux.map((x) => x.code)).toEqual(['halal']);
    expect(r.preference.map((x) => x.code)).toEqual(['vegan']);
    expect(r.timing.map((x) => x.code)).toEqual(['ramadan']);
  });

  it('Tolère casse / accents / chaîne séparée par virgules', () => {
    const r = resolveRestrictions({ restrictionsAlimentaires: 'Halal, Végan' });
    expect(r.religieux.map((x) => x.code)).toEqual(['halal']);
    expect(r.preference.map((x) => x.code)).toEqual(['vegan']);
  });

  it('Déduplique et ignore les codes inconnus', () => {
    const r = resolveRestrictions({ restrictionsAlimentaires: ['halal', 'halal', 'inconnu'] });
    expect(r.religieux).toHaveLength(1);
    expect(r.preference).toHaveLength(0);
  });

  it('Classe restrictionsAutre en texte libre', () => {
    const r = resolveRestrictions({ restrictionsAutre: 'pas de crustacés par dégoût' });
    expect(r.autreText).toBe('pas de crustacés par dégoût');
  });

  it('Fail-safe sur entrée vide / null / undefined', () => {
    expect(hasRestrictions(resolveRestrictions(null))).toBe(false);
    expect(hasRestrictions(resolveRestrictions({}))).toBe(false);
    expect(hasRestrictions(resolveRestrictions(undefined))).toBe(false);
  });

  it('hasRestrictions vrai dès une catégorie OU un texte libre', () => {
    expect(hasRestrictions(resolveRestrictions({ restrictionsAlimentaires: ['vegan'] }))).toBe(true);
    expect(hasRestrictions(resolveRestrictions({ restrictionsAutre: 'sans porc' }))).toBe(true);
  });
});
