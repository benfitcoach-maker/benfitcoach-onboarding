// P1.2 (remède sécurité clinique, 2026-06-10) — clairance clinique unique.
//
// Un plan sort par QUATRE portes (Adopter, export Word, export Fiche frigo,
// publication app cliente). Le gate doit vivre dans UNE clairance consultée
// par les quatre — pas sur un bouton (sinon trois backdoors le contournent).
//
// On teste la DÉCISION (fonction pure) `assertPlanClinicallyCleared`. Le
// câblage des 4 portes (try/catch fail-closed + override conscient) est
// vérifié à la lecture — pas d'infra de rendu React (node env).
//
// Sévérité = intrinsèque au TYPE de match (pas une colonne DB) :
//   - allergène déclaré présent dans le plan        → HIGH (bloquant)
//   - phrase interdite guardrail présente           → HIGH (bloquant)
//   - interaction « bloquante » présente            → HIGH (bloquant)
//   - intolérance présente                          → warning (non bloquant)
//   - interaction « à valider » présente            → warning (non bloquant)
// La liste bloquant/advisory est une DONNÉE révisable par Anissa
// (clinicalInteractions.js), pas une décision codée par un non-clinicien.
//
// Test ROUGE avant remède (assertPlanClinicallyCleared n'existe pas) → VERT après.

import { describe, it, expect } from 'vitest';
import { assertPlanClinicallyCleared, formatClearanceForConfirm } from '../clinicalClearance';
import { GUARDRAILS_FR } from '../prompts/nutrition/_clinicalGuardrails.fr';

const cleanPlan = 'Petit-déjeuner : flocons avoine, fruits rouges. Déjeuner : poulet, quinoa, légumes.';

describe('assertPlanClinicallyCleared — clairance clinique unique (P1.2)', () => {
  // ─── Allergènes : HIGH bloquant ────────────────────────────────────
  it('allergène déclaré présent dans le plan → HIGH, non cleared', () => {
    const v = assertPlanClinicallyCleared(
      'Snack : poignée d arachides grillées le matin.',
      { form: { allergies: 'arachide' } },
    );
    expect(v.cleared).toBe(false);
    expect(v.severity).toBe('high');
    expect(v.violations.some((x) => x.type === 'allergen')).toBe(true);
  });

  it('allergène déclaré absent du plan → pas de violation allergène', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { allergies: 'arachide' } });
    expect(v.violations.some((x) => x.type === 'allergen')).toBe(false);
  });

  // ─── Intolérances : warning non bloquant ───────────────────────────
  it('intolérance (alimentsEvites) présente → warning, reste cleared', () => {
    const v = assertPlanClinicallyCleared(
      'Dessert : yaourt au lait entier.',
      { form: { alimentsEvites: 'lait' } },
    );
    expect(v.cleared).toBe(true);
    expect(v.warnings.some((x) => x.type === 'intolerance')).toBe(true);
  });

  // ─── Guardrails : phrase interdite = HIGH ──────────────────────────
  it('phrase interdite guardrail présente → HIGH, non cleared', () => {
    const v = assertPlanClinicallyCleared(
      'On démarre par un régime restrictif strict pendant deux semaines.',
      { form: {}, guardrails: [GUARDRAILS_FR.grossesse] },
    );
    expect(v.cleared).toBe(false);
    expect(v.severity).toBe('high');
    expect(v.violations.some((x) => x.type === 'guardrail')).toBe(true);
  });

  // ─── Interaction bloquante (donnée à valider Anissa) : HIGH ────────
  it('complément contre-indiqué (millepertuis) sous antidépresseur → HIGH', () => {
    const v = assertPlanClinicallyCleared(
      'Cure de millepertuis le soir pour le moral.',
      { form: { traitements: 'sertraline' } },
    );
    expect(v.cleared).toBe(false);
    expect(v.severity).toBe('high');
    expect(v.violations.some((x) => x.type === 'interaction')).toBe(true);
  });

  it('interaction advisory (calcium sous levothyrox) → ni bloquant ni warning bruyant', () => {
    const v = assertPlanClinicallyCleared(
      'Apport calcium via produits laitiers le midi.',
      { form: { traitements: 'levothyrox' } },
    );
    expect(v.cleared).toBe(true);
    expect(v.violations.some((x) => x.type === 'interaction')).toBe(false);
  });

  // ─── Plan propre : les quatre passent ──────────────────────────────
  it('plan propre + contexte sécurité → cleared, severity none', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, {
      form: { allergies: 'arachide', alimentsEvites: 'lait', traitements: 'sertraline' },
    });
    expect(v.cleared).toBe(true);
    expect(v.severity).toBe('none');
    expect(v.violations).toEqual([]);
  });

  // ─── Fail-closed : audit qui ne tourne pas = blocage, jamais feu vert ──
  it('input illisible (null / non-string) → fail-closed, non cleared', () => {
    expect(assertPlanClinicallyCleared(null, { form: {} }).cleared).toBe(false);
    expect(assertPlanClinicallyCleared(undefined, { form: {} }).cleared).toBe(false);
    expect(assertPlanClinicallyCleared(42, { form: {} }).cleared).toBe(false);
    expect(assertPlanClinicallyCleared('', { form: {} }).cleared).toBe(false);
    // sévérité haute pour que les portes traitent comme bloquant
    expect(assertPlanClinicallyCleared(null, { form: {} }).severity).toBe('high');
  });

  it('contexte absent → ne throw pas, fail-safe sur plan propre', () => {
    const v = assertPlanClinicallyCleared(cleanPlan);
    expect(v.cleared).toBe(true);
  });
});

describe('formatClearanceForConfirm — message override conscient (P1.2)', () => {
  it('liste les violations et propose un override conscient', () => {
    const v = assertPlanClinicallyCleared('Snack arachide.', { form: { allergies: 'arachide' } });
    const msg = formatClearanceForConfirm(v);
    expect(msg).toMatch(/arachide/i);
    expect(msg).toMatch(/override conscient/i);
  });

  it('robuste sur verdict null', () => {
    expect(() => formatClearanceForConfirm(null)).not.toThrow();
  });
});
