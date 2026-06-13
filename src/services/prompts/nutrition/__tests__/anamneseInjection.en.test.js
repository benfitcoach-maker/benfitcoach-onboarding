// Fondation anamnèse V1 (2026-06-13) — miroir EN de l'injection.
// Vérifie que la nuance anti-sur-restriction et « never voluntarily propose »
// sont PRÉSERVÉES en anglais (pas une traduction au rabais).

import { describe, it, expect } from 'vitest';
import { buildSafetyBlockEn, buildSystemPromptEn } from '../en';

const baseForm = (overrides = {}) => ({ prenom: 'Test', genre: 'F', age: 35, ...overrides });

describe('Restrictions EN — 3 natures distinctes', () => {
  it('Religious (Halal) : « never voluntarily propose » + anti-over-restriction', () => {
    const block = buildSafetyBlockEn(baseForm({ restrictionsAlimentaires: ['halal'] }));
    expect(block).toContain('RELIGIOUS RESTRICTIONS');
    expect(block).toContain('Halal');
    expect(block).toMatch(/never voluntarily propose/i);
    expect(block).toMatch(/limit ONLY incompatible foods/i);
    expect(block).toMatch(/do not over-restrict/i);
  });

  it('Casher rendu « Kosher » (libellé EN), pas le libellé FR', () => {
    const block = buildSafetyBlockEn(baseForm({ restrictionsAlimentaires: ['casher'] }));
    expect(block).toContain('Kosher');
    expect(block).not.toContain('Casher');
  });

  it('Preference (Vegan) : best-effort + clause anti-over-restriction vegan', () => {
    const block = buildSafetyBlockEn(baseForm({ restrictionsAlimentaires: ['vegan'] }));
    expect(block).toContain('Vegan');
    expect(block).toMatch(/as much as possible/i);
    expect(block).toMatch(/excludes ONLY animal products/i);
    expect(block).not.toMatch(/RELIGIOUS RESTRICTIONS/);
  });

  it('Ramadan (timing) : meal structure + hydration, PAS « incompatible food »', () => {
    const block = buildSafetyBlockEn(baseForm({ restrictionsAlimentaires: ['ramadan'] }));
    expect(block).toContain('RAMADAN');
    expect(block).toMatch(/eating window/i);
    expect(block).toMatch(/hydration/i);
    expect(block).not.toMatch(/never voluntarily propose a food incompatible/i);
  });
});

describe('Compléments actuels EN — anti-doublon', () => {
  it('Injecte la liste + consigne anti-doublon', () => {
    const block = buildSafetyBlockEn(baseForm({ complementsActuels: [{ nom: 'Vitamin D', dose: '1000 IU' }] }));
    expect(block).toContain('SUPPLEMENTS the client already takes');
    expect(block).toContain('Vitamin D (1000 IU)');
    expect(block).toMatch(/do not recommend a duplicate/i);
  });

  it('Présent dans le prompt assemblé (chemin actif buildSystemPromptEn)', () => {
    const prompt = buildSystemPromptEn(baseForm({ complementsActuels: [{ nom: 'Magnesium', dose: '300 mg' }] }), {});
    expect(prompt).toContain('Magnesium (300 mg)');
  });
});

describe('Ouverture compléments EN — directive souple', () => {
  it('« eviter » → favour food', () => {
    const prompt = buildSystemPromptEn(baseForm({ ouvertureComplements: 'eviter' }), {});
    expect(prompt).toContain('OPENNESS TO SUPPLEMENTS');
    expect(prompt).toMatch(/prefers to avoid/i);
  });

  it('Non renseignée → aucune directive', () => {
    const prompt = buildSystemPromptEn(baseForm(), {});
    expect(prompt).not.toContain('OPENNESS TO SUPPLEMENTS');
  });
});
