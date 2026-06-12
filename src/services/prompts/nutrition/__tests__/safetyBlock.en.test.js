// P0.5 (remède sécurité clinique, 2026-06-10) — capteur sécurité chemin EN.
//
// Le check du MUR P0 a révélé un 4e chemin de génération non couvert :
// les clientes en locale EN passent par buildSystemPromptEn (en.js), qui
// n'avait AUCUN bloc sécurité. C'est exactement le finding #1 (plan aveugle
// aux allergènes / traitements), en anglais. Le périmètre de P0 n'a jamais
// été « le français » mais « la sécurité atteint CHAQUE chemin de génération
// qui existe » — EN est un chemin qui existe.
//
// Exigence identique au FR : un traitement connu ET un allergène connu
// apparaissent dans le system prompt anglais envoyé à l'IA. La présence,
// constatée — pas « le chemin génère ».
//
// Test ROUGE avant remède (buildSafetyBlockEn n'existe pas / non câblé) → VERT après.

import { describe, it, expect } from 'vitest';
import { buildSafetyBlockEn, buildSystemPromptEn } from '../en';

// Mêmes exemples que le test FR : un anticoagulant + un allergène majeur.
const MED = 'Sintrom (anticoagulant)';
const ALLERGEN = 'peanut';
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

// ─── buildSafetyBlockEn : la source unique EN ─────────────────────

describe('buildSafetyBlockEn — source unique du bloc sécurité (EN)', () => {
  it('Rend allergènes + intolérances + traitements quand présents', () => {
    const block = buildSafetyBlockEn(safetyForm());
    expect(block).toContain(MED);
    expect(block).toContain(ALLERGEN);
    expect(block).toContain(INTOLERANCE);
  });

  it('Accepte form.medicaments comme alias de form.traitements', () => {
    const block = buildSafetyBlockEn(safetyForm({ traitements: '', medicaments: MED }));
    expect(block).toContain(MED);
  });

  it('Retourne une chaîne vide si aucune donnée sécurité', () => {
    expect(buildSafetyBlockEn({ prenom: 'X' })).toBe('');
    expect(buildSafetyBlockEn(null)).toBe('');
    expect(buildSafetyBlockEn(undefined)).toBe('');
  });

  it('Porte la même force impérative que le FR (override + STRICTLY EXCLUDE)', () => {
    const block = buildSafetyBlockEn(safetyForm());
    expect(block).toMatch(/override/i);
    expect(block).toMatch(/strictly exclude/i);
  });

  // Pendant du piège « génération sur form vide » : un capteur qui s'affiche
  // sans donnée crée du bruit, voire une consigne vide que l'IA interprète
  // mal. Chaque ligne ne doit apparaître que pour un champ réellement rempli.
  it('Omet proprement les lignes des champs vides (pas de consigne vide)', () => {
    // Cliente EN avec seulement un traitement : ni allergène ni intolérance.
    const block = buildSafetyBlockEn(safetyForm({ allergies: '', alimentsEvites: '' }));
    expect(block).toContain(MED);
    expect(block).not.toContain('DECLARED ALLERGENS');
    expect(block).not.toMatch(/Intolerances/i);
    // Pas de titre de ligne suivi de vide.
    expect(block).not.toMatch(/EXCLUDE:\s*\./);
  });
});

// ─── Chemin EN : buildSystemPromptEn ──────────────────────────────

describe('Sécurité — chemin EN', () => {
  it('buildSystemPromptEn injecte allergène ET traitement', () => {
    const prompt = buildSystemPromptEn(safetyForm(), {});
    expect(prompt).toContain(ALLERGEN);
    expect(prompt).toContain(MED);
  });
});

// ─── P0 MATERNEL (Module 1) — miroir EN ───────────────────────────

const maternalForm = (overrides = {}) => ({
  prenom: 'Test',
  genre: 'F',
  age: 30,
  ...overrides,
});

describe('P0 maternel — buildSafetyBlockEn (miroir)', () => {
  it('Grossesse in-app : contraintes présentes sans allergie/médicament', () => {
    const block = buildSafetyBlockEn(maternalForm({ grossesseActuelle: 'Grossesse' }));
    expect(block).toContain('PREGNANCY');
    expect(block).toMatch(/fasting/i);
    expect(block).toMatch(/caloric restriction/i);
    expect(block).toMatch(/vitamin A/i);
    expect(block).toMatch(/iodine/i);
  });

  it('Allaitement in-app : contraintes allaitement présentes, grossesse absentes', () => {
    const block = buildSafetyBlockEn(maternalForm({ grossesseActuelle: 'Allaitement' }));
    expect(block).toContain('BREASTFEEDING');
    expect(block).toMatch(/supplementation/i);
    expect(block).not.toMatch(/fasting/i);
    expect(block).not.toContain('PREGNANCY');
  });

  it('Post-partum : DÉTECTÉ mais aucun bloc en V1 (gap clinique)', () => {
    const block = buildSafetyBlockEn(maternalForm({ grossesseActuelle: 'PostPartum' }));
    expect(block).toBe('');
  });

  it('Chemin EN actif : buildSystemPromptEn injecte les contraintes grossesse', () => {
    const prompt = buildSystemPromptEn(maternalForm({ grossesseActuelle: 'Grossesse' }), {});
    expect(prompt).toContain('PREGNANCY');
    expect(prompt).toMatch(/fasting/i);
  });
});
