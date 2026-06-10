// P0.1 + P0.2 (remède sécurité clinique, 2026-06-10) — capteur sécurité.
//
// Garantit que les données de sécurité clinique (allergènes, intolérances,
// traitements/médicaments) arrivent dans le system prompt envoyé à l'IA sur
// CHACUN des chemins de génération de plan. L'archi réelle compte trois
// constructions de prompt divergentes (cf. correction 2026-06-10 du remède) :
//   1. Composer    → composeSystemPromptFr / buildSystemPromptFrV2(useComposer)
//   2. Classique   → buildSystemPromptFr / buildSystemPromptFrV2 (legacy)
//   3. Legacy NutritionConsultation → route par l'un OU l'autre builder
//      ci-dessus (cf. NutritionConsultation.jsx:104/106), donc couvert par les
//      deux blocs de tests ci-dessous.
//
// Test ROUGE avant remède (le bloc n'existe pas) → VERT après.

import { describe, it, expect } from 'vitest';
import { buildSafetyBlockFr } from '../_clinicalContext.fr';
import { composeSystemPromptFr } from '../composer.fr';
import { buildSystemPromptFr, buildSystemPromptFrV2 } from '../fr';

// Exemples tirés du remède : un anticoagulant + un allergène majeur.
const MED = 'Sintrom (anticoagulant)';
const ALLERGEN = 'arachide';
const INTOLERANCE = 'lactose';

const safetyForm = (overrides = {}) => ({
  prenom: 'Test',
  genre: 'F',
  age: 40,
  traitements: MED,
  allergies: ALLERGEN,
  alimentsEvites: INTOLERANCE,
  ...overrides,
});

// ─── buildSafetyBlockFr : la source unique ────────────────────────

describe('buildSafetyBlockFr — source unique du bloc sécurité', () => {
  it('Rend allergènes + intolérances + traitements quand présents', () => {
    const block = buildSafetyBlockFr(safetyForm());
    expect(block).toContain(MED);
    expect(block).toContain(ALLERGEN);
    expect(block).toContain(INTOLERANCE);
  });

  it('Accepte form.medicaments comme alias de form.traitements', () => {
    const block = buildSafetyBlockFr(safetyForm({ traitements: '', medicaments: MED }));
    expect(block).toContain(MED);
  });

  it('Retourne une chaîne vide si aucune donnée sécurité', () => {
    expect(buildSafetyBlockFr({ prenom: 'X' })).toBe('');
    expect(buildSafetyBlockFr(null)).toBe('');
    expect(buildSafetyBlockFr(undefined)).toBe('');
  });
});

// ─── Chemin 1 : COMPOSER ──────────────────────────────────────────

describe('Sécurité — chemin composer', () => {
  it('composeSystemPromptFr injecte allergène ET traitement', () => {
    const { prompt } = composeSystemPromptFr(safetyForm(), {}, null);
    expect(prompt).toContain(ALLERGEN);
    expect(prompt).toContain(MED);
  });

  it('buildSystemPromptFrV2(useComposer) injecte allergène ET traitement', () => {
    const { prompt } = buildSystemPromptFrV2(safetyForm(), {}, { useComposer: true });
    expect(prompt).toContain(ALLERGEN);
    expect(prompt).toContain(MED);
  });
});

// ─── Chemin 2 : CLASSIQUE ─────────────────────────────────────────

describe('Sécurité — chemin classique', () => {
  it('buildSystemPromptFr injecte allergène ET traitement', () => {
    const prompt = buildSystemPromptFr(safetyForm(), {});
    expect(prompt).toContain(ALLERGEN);
    expect(prompt).toContain(MED);
  });

  it('buildSystemPromptFrV2 (legacy) injecte allergène ET traitement', () => {
    const { prompt } = buildSystemPromptFrV2(safetyForm(), {});
    expect(prompt).toContain(ALLERGEN);
    expect(prompt).toContain(MED);
  });
});
