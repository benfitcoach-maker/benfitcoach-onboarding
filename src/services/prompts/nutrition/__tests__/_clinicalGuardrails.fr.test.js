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
  auditPlanCompleteness,
} from '../_clinicalGuardrails.fr';

// ─── detectClinicalGuardrails ────────────────────────────────────────────

describe('detectClinicalGuardrails', () => {
  it('Retourne [] si profile null', () => {
    expect(detectClinicalGuardrails(null, {})).toEqual([]);
  });

  it('Retourne [] si aucun profil ne matche un guardrail', () => {
    // V97.x Phase 2 : femmeCycle simple (sans pathologie/grossesse/ado/menopause)
    // ne déclenche aucun garde-fou.
    const profile = { tag: 'femmeCycle', all: ['femmeCycle'] };
    expect(detectClinicalGuardrails(profile, { age: '30' })).toEqual([]);
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

// ─── V97.x Phase 2 — Tests 7 profils + complétude ────────────────────────

describe('detectClinicalGuardrails — 7 profils Phase 2', () => {
  it('Matche allaitement', () => {
    const profile = { tag: 'allaitement', all: ['allaitement'] };
    const matched = detectClinicalGuardrails(profile, {});
    expect(matched.some((g) => g.profile_key === 'allaitement')).toBe(true);
  });

  it('Matche postPartum', () => {
    const profile = { tag: 'postPartum', all: ['postPartum'] };
    const matched = detectClinicalGuardrails(profile, {});
    expect(matched.some((g) => g.profile_key === 'postPartum')).toBe(true);
  });

  it('Matche adolescente quand age < 18', () => {
    const profile = { tag: 'femmeCycle', all: ['femmeCycle'] };
    const matched = detectClinicalGuardrails(profile, { age: '16' });
    expect(matched.some((g) => g.profile_key === 'adolescente')).toBe(true);
  });

  it('Matche menopause (peri ou post)', () => {
    const p1 = { tag: 'menopause', all: ['menopause'] };
    const p2 = { tag: 'perimenopause', all: ['perimenopause'] };
    expect(detectClinicalGuardrails(p1, {}).some((g) => g.profile_key === 'menopause')).toBe(true);
    expect(detectClinicalGuardrails(p2, {}).some((g) => g.profile_key === 'menopause')).toBe(true);
  });

  it('Matche diabete (T1 ou T2)', () => {
    const profile = { tag: 'diabete', all: ['diabete'] };
    const matched = detectClinicalGuardrails(profile, {});
    expect(matched.some((g) => g.profile_key === 'diabete')).toBe(true);
  });

  it('Matche pathologieCritique (fallback) pour tags spécifiques', () => {
    const profile = { tag: 'clostridiumDifficile', all: ['clostridiumDifficile'] };
    const matched = detectClinicalGuardrails(profile, {});
    expect(matched.some((g) => g.profile_key === 'pathologieCritique')).toBe(true);
  });

  it('Cumule plusieurs guardrails (grossesse + diabete gestationnel)', () => {
    const profile = { tag: 'grossesse', all: ['grossesse', 'diabete'] };
    const matched = detectClinicalGuardrails(profile, {});
    const keys = matched.map((g) => g.profile_key);
    expect(keys).toContain('grossesse');
    expect(keys).toContain('diabete');
  });
});

describe('buildGuardrailsBlockFr — sections Phase 2', () => {
  it('Liste les micronutriments quand profil grossesse', () => {
    const block = buildGuardrailsBlockFr([GUARDRAILS_FR.grossesse]);
    expect(block).toContain('À NOMMER OBLIGATOIREMENT');
    expect(block).toContain('iode');
    expect(block).toContain('acide folique');
  });

  it('Liste les évictions quand profil grossesse', () => {
    const block = buildGuardrailsBlockFr([GUARDRAILS_FR.grossesse]);
    expect(block).toContain('À MENTIONNER dans la section éviction');
    expect(block).toContain('listeria');
    expect(block).toContain('toxoplasmose');
  });

  it('Liste les formulations attendues quand profil allaitement', () => {
    const block = buildGuardrailsBlockFr([GUARDRAILS_FR.allaitement]);
    expect(block).toContain('FORMULATIONS ATTENDUES');
    expect(block).toContain('éviter alcool');
  });

  it('Cumul grossesse + diabete — toutes phrases interdites fusionnees', () => {
    const block = buildGuardrailsBlockFr([
      GUARDRAILS_FR.grossesse,
      GUARDRAILS_FR.diabete,
    ]);
    expect(block).toContain('Grossesse + Diabète');
    expect(block).toContain('éviter tes injections'); // grossesse
    expect(block).toContain('arrête ta metformine'); // diabete
  });
});

describe('auditPlanCompleteness — completude Phase 2', () => {
  const grossesseGuardrails = [GUARDRAILS_FR.grossesse];

  it('Retourne tous les manques si plan vide', () => {
    const result = auditPlanCompleteness('Plan minimaliste', grossesseGuardrails);
    expect(result.missing_micronutrients.length).toBeGreaterThan(0);
    expect(result.missing_evictions.length).toBeGreaterThan(0);
  });

  it('Detecte les micronutriments mentionnes', () => {
    const plan = `
      Iode : sels iodés au quotidien.
      Acide folique : légumes verts à feuilles.
      Fer héminique : viandes maigres.
      Oméga-3 : poissons gras 2x/semaine.
    `;
    const result = auditPlanCompleteness(plan, grossesseGuardrails);
    // Iode + folique + fer + oméga ne doivent PAS etre missing
    const missing = result.missing_micronutrients.map((m) => m.item);
    expect(missing).not.toContain('iode');
    expect(missing).not.toContain('acide folique');
    expect(missing).not.toContain('fer');
    expect(missing).not.toContain('oméga-3');
  });

  it('Detecte les evictions mentionnees', () => {
    const plan = `
      Précautions : éviter la listeria (fromages au lait cru),
      la toxoplasmose (viande peu cuite), l'alcool en totalité,
      le mercure des gros poissons (thon, espadon).
    `;
    const result = auditPlanCompleteness(plan, grossesseGuardrails);
    const missing = result.missing_evictions.map((e) => e.item);
    expect(missing.some((m) => m.includes('listeria'))).toBe(false);
    expect(missing.some((m) => m.includes('toxoplasmose'))).toBe(false);
    expect(missing.some((m) => m.includes('alcool'))).toBe(false);
  });

  it('Regression Hawazen : plan original n\'avait pas iode → flag', () => {
    const hawazenPlan = `
      Stratégie : stabilité glycémique, gestion du stress et soutien grossesse.
      Acide folique présent dans légumes verts.
      Fer dans viandes rouges maigres.
    `;
    const result = auditPlanCompleteness(hawazenPlan, grossesseGuardrails);
    const missingMicros = result.missing_micronutrients.map((m) => m.item);
    expect(missingMicros).toContain('iode');
  });
});
