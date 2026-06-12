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

  // Micro-correctif P0.1 (révélé par la traduction EN de P0.5) : le titre de
  // la ligne allergènes doit porter l'injonction « À EXCLURE STRICTEMENT »,
  // pas seulement le corps. Sinon la force de la consigne est moindre que
  // côté EN (« STRICTLY EXCLUDE »).
  it('Le titre allergènes porte la force impérative (À EXCLURE STRICTEMENT)', () => {
    const block = buildSafetyBlockFr(safetyForm());
    expect(block).toMatch(/à exclure strictement/i);
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

// ─── P0 MATERNEL (Module 1) : contraintes préventives sur le chemin ACTIF ──
//
// Le chemin réellement actif en prod = composerBeta false → buildSystemPromptFr
// (cf. WIRING.md, NutritionConsultation.jsx). Ces tests prouvent que le CANAL
// RÉEL est protégé, pas seulement le composer OPT-IN. Source = resolveMaternalState,
// donc le format in-app combiné (grossesseActuelle = "Grossesse"/"Allaitement")
// est lu directement.

// Cliente in-app SANS allergie ni médicament (le cas qui aurait court-circuité
// la garde précoce avant le P0).
const maternalForm = (overrides = {}) => ({
  prenom: 'Test',
  genre: 'F',
  age: 30,
  ...overrides,
});

describe('P0 maternel — buildSafetyBlockFr (source unique)', () => {
  it('Grossesse in-app : contraintes présentes même sans allergie/médicament', () => {
    const block = buildSafetyBlockFr(maternalForm({ grossesseActuelle: 'Grossesse' }));
    expect(block).toContain('GROSSESSE');
    expect(block).toMatch(/jeûne/i);
    expect(block).toMatch(/restriction calorique/i);
    expect(block).toMatch(/vitamine A/i);
    expect(block).toMatch(/iode/i);
  });

  it('Allaitement in-app : contraintes allaitement présentes, grossesse absentes', () => {
    const block = buildSafetyBlockFr(maternalForm({ grossesseActuelle: 'Allaitement' }));
    expect(block).toContain('ALLAITEMENT');
    expect(block).toMatch(/restriction calorique/i);
    expect(block).toMatch(/supplémentation/i);
    // Pas de contamination grossesse.
    expect(block).not.toMatch(/jeûne/i);
    expect(block).not.toMatch(/vitamine A/i);
    expect(block).not.toContain('GROSSESSE');
  });

  it('Format legacy séparé (cockpit) : allaitement = "Oui" déclenche le bloc', () => {
    const block = buildSafetyBlockFr(maternalForm({ allaitement: 'Oui' }));
    expect(block).toContain('ALLAITEMENT');
    expect(block).toMatch(/supplémentation/i);
  });

  it('Post-partum : DÉTECTÉ mais AUCUN bloc maternel en V1 (gap clinique)', () => {
    const block = buildSafetyBlockFr(maternalForm({ grossesseActuelle: 'PostPartum' }));
    // Pas de contrainte maternelle injectée, et pas de bloc sécurité vide forcé.
    expect(block).not.toContain('GROSSESSE');
    expect(block).not.toContain('ALLAITEMENT');
    expect(block).toBe('');
  });

  it('Aucun état maternel : pas de bloc maternel (non-régression)', () => {
    const block = buildSafetyBlockFr(maternalForm({ grossesseActuelle: 'Non' }));
    expect(block).toBe('');
  });
});

describe('P0 maternel — chemin ACTIF réel (composerBeta=false → buildSystemPromptFr)', () => {
  it('Grossesse in-app : contraintes grossesse dans le prompt assemblé', () => {
    const prompt = buildSystemPromptFr(maternalForm({ grossesseActuelle: 'Grossesse' }), {});
    expect(prompt).toContain('GROSSESSE');
    expect(prompt).toMatch(/jeûne/i);
    expect(prompt).toMatch(/vitamine A/i);
    expect(prompt).toMatch(/iode/i);
  });

  it('Allaitement in-app : contraintes allaitement dans le prompt, grossesse absentes', () => {
    const prompt = buildSystemPromptFr(maternalForm({ grossesseActuelle: 'Allaitement' }), {});
    expect(prompt).toContain('ALLAITEMENT');
    expect(prompt).toMatch(/supplémentation/i);
    expect(prompt).not.toMatch(/jeûne/i);
  });

  it('Maternel + allergène cumulés sur le chemin actif', () => {
    const prompt = buildSystemPromptFr(
      maternalForm({ grossesseActuelle: 'Grossesse', allergies: ALLERGEN }),
      {},
    );
    expect(prompt).toContain('GROSSESSE');
    expect(prompt).toContain(ALLERGEN);
  });
});
