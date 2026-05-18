// V97.x Phase 1 — Tests des garde-fous cliniques (grossesse).
// Cf spec : spec-composer-v97-clinical-antislop.md
//
// Couverture :
//   - detectClinicalGuardrails : matching profil → guardrail
//   - buildGuardrailsBlockFr : assemblage prompt (presence phrases clés)
//   - auditPlanForGuardrails : détection violations (case insensitive,
//     occurrences multiples, snippet contexte)
//   - Regression Hawazen : les 2 phrases médicales à risque sont bien
//     détectées par l'audit

import { describe, it, expect } from 'vitest';
import {
  GUARDRAILS_FR,
  detectClinicalGuardrails,
  buildGuardrailsBlockFr,
  auditPlanForGuardrails,
} from '../_clinicalGuardrails.fr';

// ─── detectClinicalGuardrails ────────────────────────────────────────────

describe('detectClinicalGuardrails', () => {
  it('Retourne [] si profile null', () => {
    expect(detectClinicalGuardrails(null, {})).toEqual([]);
  });

  it('Retourne [] si pas de profil grossesse', () => {
    const profile = { tag: 'menopause', all: ['menopause'] };
    expect(detectClinicalGuardrails(profile, {})).toEqual([]);
  });

  it('Matche grossesse via profile.tag', () => {
    const profile = { tag: 'grossesse', all: ['grossesse'] };
    const matched = detectClinicalGuardrails(profile, {});
    expect(matched).toHaveLength(1);
    expect(matched[0].profile_key).toBe('grossesse');
  });

  it('Matche grossesse via profile.all (cumul pathologie)', () => {
    // Cas Hawazen : grossesse T2 + TDAH (tag primary peut etre tdah)
    const profile = { tag: 'tdah', all: ['tdah', 'grossesse'] };
    const matched = detectClinicalGuardrails(profile, {});
    expect(matched).toHaveLength(1);
    expect(matched[0].profile_key).toBe('grossesse');
  });
});

// ─── buildGuardrailsBlockFr ──────────────────────────────────────────────

describe('buildGuardrailsBlockFr', () => {
  it('Retourne empty string si pas de guardrails', () => {
    expect(buildGuardrailsBlockFr([])).toBe('');
    expect(buildGuardrailsBlockFr(null)).toBe('');
  });

  it('Genere un bloc avec le header CONTRAINTES CLINIQUES', () => {
    const block = buildGuardrailsBlockFr([GUARDRAILS_FR.grossesse]);
    expect(block).toContain('CONTRAINTES CLINIQUES NON-NÉGOCIABLES');
    expect(block).toContain('Profil(s) détecté(s) : Grossesse');
  });

  it('Liste toutes les phrases interdites', () => {
    const block = buildGuardrailsBlockFr([GUARDRAILS_FR.grossesse]);
    // Vérif 3 phrases clés du cas Hawazen
    expect(block).toContain('éviter tes injections');
    expect(block).toContain('plus efficace que les comprimés');
    expect(block).toContain('à la place du médecin');
  });

  it('Liste le vocabulaire de précaution', () => {
    const block = buildGuardrailsBlockFr([GUARDRAILS_FR.grossesse]);
    expect(block).toContain('VOCABULAIRE OBLIGATOIRE');
    expect(block).toContain('"à la place de" → "en complément de"');
  });

  it('Inclut le rappel de scope nutritionniste', () => {
    const block = buildGuardrailsBlockFr([GUARDRAILS_FR.grossesse]);
    expect(block).toContain('PRATICIENNE EN NUTRITION');
    expect(block).toContain('jamais en substitution');
  });
});

// ─── auditPlanForGuardrails ──────────────────────────────────────────────

describe('auditPlanForGuardrails', () => {
  const grossesseGuardrails = [GUARDRAILS_FR.grossesse];

  it('Retourne [] si plan vide ou guardrails vides', () => {
    expect(auditPlanForGuardrails('', grossesseGuardrails)).toEqual([]);
    expect(auditPlanForGuardrails('Plan ok', [])).toEqual([]);
  });

  it('Retourne [] si plan ne contient aucune phrase interdite', () => {
    const cleanPlan = 'Voici ton plan. Continue ta supplémentation prescrite, prends bien tes repas.';
    expect(auditPlanForGuardrails(cleanPlan, grossesseGuardrails)).toEqual([]);
  });

  it('Détecte "éviter tes injections" (case-insensitive)', () => {
    const dirtyPlan = 'Avec ce protocole, ÉVITER TES INJECTIONS ANNUELLES sera possible.';
    const violations = auditPlanForGuardrails(dirtyPlan, grossesseGuardrails);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.phrase.includes('éviter tes injections'))).toBe(true);
  });

  it('Détecte "plus efficace que les comprimés"', () => {
    const dirtyPlan = "Cette approche est plus efficace que les comprimés seuls.";
    const violations = auditPlanForGuardrails(dirtyPlan, grossesseGuardrails);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.phrase.includes('plus efficace que les comprimés'))).toBe(true);
  });

  it('Détecte occurrences multiples de la même phrase', () => {
    const plan = 'éviter tes injections cette fois. Et plus tard, éviter tes injections aussi.';
    const violations = auditPlanForGuardrails(plan, grossesseGuardrails);
    const evite = violations.filter((v) => v.phrase === 'éviter tes injections');
    expect(evite.length).toBe(2);
  });

  it('Fournit un snippet contextuel pour chaque violation', () => {
    const plan = 'Conseil important : avec ce regime tu peux éviter tes injections quotidiennes et rester active.';
    const violations = auditPlanForGuardrails(plan, grossesseGuardrails);
    expect(violations[0].snippet).toContain('éviter tes injections');
    expect(violations[0].snippet.startsWith('...')).toBe(true);
    expect(violations[0].snippet.endsWith('...')).toBe(true);
  });

  it('Regression Hawazen : les 2 phrases du cas reel sont detectees', () => {
    const hawazenSnippet = `
      Ton protocole personnalise integre les meilleurs gestes nutritionnels.
      Avec cette approche, ÉVITER TES INJECTIONS ANNUELLES devient envisageable.
      Cette strategie est plus efficace que les comprimés seuls car elle agit
      sur plusieurs leviers.
    `;
    const violations = auditPlanForGuardrails(hawazenSnippet, grossesseGuardrails);
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.some((v) => v.phrase.includes('éviter tes injections'))).toBe(true);
    expect(violations.some((v) => v.phrase.includes('plus efficace que les comprimés'))).toBe(true);
  });

  it('Detecte "guérir" (verbe médical interdit scope nutritionniste)', () => {
    const plan = 'Ce regime peut guérir tes symptômes en 6 semaines.';
    const violations = auditPlanForGuardrails(plan, grossesseGuardrails);
    expect(violations.some((v) => v.phrase === 'guérir')).toBe(true);
  });
});
