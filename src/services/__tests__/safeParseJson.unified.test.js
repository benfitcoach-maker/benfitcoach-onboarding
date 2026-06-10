// P0.4 (remède sécurité clinique, 2026-06-10) — unification safeParseJson.
//
// Avant : deux fonctions homonymes aux contrats opposés — anthropic.js renvoyait
// `null` en silence (fail-open), aiMedicalSummary.js throw (fail-closed). Le
// générateur de recettes héritait du fail-open et crashait avec un TypeError
// opaque (`parsed.recipes` sur null).
//
// Après : un seul contrat fail-closed (throw message clair). Test ROUGE avant
// remède (anthropic safeParseJson renvoie null) → VERT après.

import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock partiel : on garde le vrai safeParseJson (fail-closed) et on ne stubbe
// que callClaude pour piloter la réponse IA renvoyée au générateur de recettes.
vi.mock('../anthropic', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, callClaude: vi.fn() };
});

import { safeParseJson, ClaudeApiError, callClaude } from '../anthropic';
import { generateRecipesForMeals } from '../aiRecipeGenerator';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeParseJson — contrat unifié fail-closed (P0.4)', () => {
  it('throw sur JSON tronqué (plus de null silencieux)', () => {
    expect(() => safeParseJson('{"recipes": {"lundi_midi": {"ingred')).toThrow(/JSON.*invalide/i);
  });

  it('throw sur vide / null / undefined', () => {
    expect(() => safeParseJson('')).toThrow();
    expect(() => safeParseJson(null)).toThrow();
    expect(() => safeParseJson(undefined)).toThrow();
  });

  it('throw une ClaudeApiError taguée parseError', () => {
    let caught = null;
    try {
      safeParseJson('{ ceci nest pas du json');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ClaudeApiError);
    expect(caught.payload?.parseError).toBe(true);
  });

  it('parse correctement le JSON valide (markdown / texte autour)', () => {
    expect(safeParseJson('```json\n{"a":1}\n```').a).toBe(1);
    expect(safeParseJson('Voici : {"a":2} fin').a).toBe(2);
  });
});

describe('aiRecipeGenerator — JSON tronqué = erreur honnête (P0.4)', () => {
  it('throw une erreur honnête, pas un TypeError opaque ni un résultat partiel', async () => {
    // Réponse IA tronquée (JSON incomplet)
    callClaude.mockResolvedValue('{"recipes": {"lundi_midi": {"ingred');
    const meals = [{ key: 'lundi_midi', slot: 'midi', title: 'Salade' }];

    await expect(
      generateRecipesForMeals(meals, { form: {}, locale: 'fr' }),
    ).rejects.toBeInstanceOf(ClaudeApiError);

    await expect(
      generateRecipesForMeals(meals, { form: {}, locale: 'fr' }),
    ).rejects.toThrow(/JSON.*invalide/i);
  });
});
