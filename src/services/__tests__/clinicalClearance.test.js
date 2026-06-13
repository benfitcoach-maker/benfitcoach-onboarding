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
import { assertPlanClinicallyCleared, classifyAge, formatClearanceForConfirm, clearanceBadge } from '../clinicalClearance';
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

  // ─── Escalade conditionnelle (D1-A, réf. VALIDATION-CLINIQUE-ANISSA-V1) ──
  it('berbérine dans le plan + insuline active → HIGH (escalade bloquante)', () => {
    const v = assertPlanClinicallyCleared(
      'Cure de berberine matin et soir pour la glycémie.',
      { form: { traitements: 'insuline lantus' } },
    );
    expect(v.cleared).toBe(false);
    expect(v.violations.some((x) => x.type === 'interaction')).toBe(true);
  });

  it('chrome dans le plan + insuline active → advisory (ni bloquant ni warning)', () => {
    const v = assertPlanClinicallyCleared(
      'Complément chrome pour soutenir le métabolisme.',
      { form: { traitements: 'insuline lantus' } },
    );
    expect(v.cleared).toBe(true);
    expect(v.violations.some((x) => x.type === 'interaction')).toBe(false);
    expect(v.warnings.some((x) => x.type === 'interaction_review')).toBe(false);
  });

  it('oméga-3 forte dose dans le plan + AVK actif → HIGH (escalade bloquante)', () => {
    const v = assertPlanClinicallyCleared(
      'Ajout omega-3 forte dose quotidien.',
      { form: { traitements: 'sintrom' } },
    );
    expect(v.cleared).toBe(false);
    expect(v.violations.some((x) => x.type === 'interaction')).toBe(true);
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

// Détection mineur (2026-06-13) — blocage PROFILE-based (≠ content-based).
// Règle Anissa : mineure (1..17) → HIGH bloquant (validation obligatoire,
// override conscient possible) ; âge inconnu → warning LOW (fail-open) ; majeure
// → rien. Tests sur PLAN PROPRE NON VIDE : un plan vide déclencherait FAIL_CLOSED
// (cleared:false) et masquerait l'origine du blocage — on veut prouver que le
// blocage 16-ans vient de la RÈGLE MINEUR, pas du fail-closed.
describe('classifyAge — classifieur tri-état (cas limites)', () => {
  it('minor : 16 / 14 / 17 / "16" / "16 ans"', () => {
    expect(classifyAge({ age: 16 })).toBe('minor');
    expect(classifyAge({ age: 14 })).toBe('minor');
    expect(classifyAge({ age: 17 })).toBe('minor');
    expect(classifyAge({ age: '16' })).toBe('minor');
    expect(classifyAge({ age: '16 ans' })).toBe('minor');
  });

  it('adult : 18 / 25 / 120', () => {
    expect(classifyAge({ age: 18 })).toBe('adult');
    expect(classifyAge({ age: 25 })).toBe('adult');
    expect(classifyAge({ age: 120 })).toBe('adult');
  });

  it('unknown : "" / null / "abc" / 0 / -5 / 200 / clé absente / form absent', () => {
    expect(classifyAge({ age: '' })).toBe('unknown');
    expect(classifyAge({ age: null })).toBe('unknown');
    expect(classifyAge({ age: 'abc' })).toBe('unknown');
    expect(classifyAge({ age: 0 })).toBe('unknown');   // piège : champ vide parsé en 0
    expect(classifyAge({ age: -5 })).toBe('unknown');
    expect(classifyAge({ age: 200 })).toBe('unknown'); // absurde
    expect(classifyAge({})).toBe('unknown');           // clé absente
    expect(classifyAge(null)).toBe('unknown');         // form absent
    expect(classifyAge(undefined)).toBe('unknown');
  });

  it('fallback sur ageActuel si age absent', () => {
    expect(classifyAge({ ageActuel: 16 })).toBe('minor');
    expect(classifyAge({ ageActuel: 30 })).toBe('adult');
  });
});

describe('assertPlanClinicallyCleared — détection mineur PROFILE-based', () => {
  it('mineure 16 ans + plan PROPRE → HIGH bloquant via la RÈGLE MINEUR (pas le fail-closed)', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 16 } });
    expect(v.cleared).toBe(false);
    expect(v.severity).toBe('high');
    expect(v.violations.some((x) => x.type === 'minor')).toBe(true);
    // Preuve que ce n'est PAS le fail-closed : pas d'erreur de clairance, et le
    // plan propre n'a déclenché aucune autre violation.
    expect(v.violations.some((x) => x.type === 'clearance_error')).toBe(false);
    expect(v.violations).toHaveLength(1);
  });

  it('mineure 14 ans (borne basse) + plan propre → HIGH bloquant', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 14 } });
    expect(v.cleared).toBe(false);
    expect(v.violations.some((x) => x.type === 'minor')).toBe(true);
  });

  it('majeure 18 ans + plan propre → cleared, aucune violation mineur', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 18 } });
    expect(v.cleared).toBe(true);
    expect(v.severity).toBe('none');
    expect(v.violations.some((x) => x.type === 'minor')).toBe(false);
  });

  it('majeure 25 ans + plan propre → cleared', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 25 } });
    expect(v.cleared).toBe(true);
    expect(v.violations.some((x) => x.type === 'minor')).toBe(false);
  });

  it('âge absent + plan propre → fail-OPEN : warning age_unknown, reste cleared', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: {} });
    expect(v.cleared).toBe(true);
    expect(v.warnings.some((x) => x.type === 'age_unknown')).toBe(true);
  });

  it('âge 0 (piège champ vide) + plan propre → warning, jamais bloquant', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 0 } });
    expect(v.cleared).toBe(true);
    expect(v.violations.some((x) => x.type === 'minor')).toBe(false);
    expect(v.warnings.some((x) => x.type === 'age_unknown')).toBe(true);
  });

  it('âge invalide "abc" + plan propre → warning age_unknown, cleared', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 'abc' } });
    expect(v.cleared).toBe(true);
    expect(v.warnings.some((x) => x.type === 'age_unknown')).toBe(true);
  });

  // COEXISTENCE profile-based (mineur) + content-based (allergène) : 2 violations.
  it('mineure 16 + allergène présent dans le plan → 2 violations (minor + allergen)', () => {
    const v = assertPlanClinicallyCleared(
      'Snack : poignée d arachides grillées le matin.',
      { form: { age: 16, allergies: 'arachide' } },
    );
    expect(v.cleared).toBe(false);
    expect(v.severity).toBe('high');
    expect(v.violations.some((x) => x.type === 'minor')).toBe(true);
    expect(v.violations.some((x) => x.type === 'allergen')).toBe(true);
    expect(v.violations).toHaveLength(2);
  });

  it('mineure → la ligne mineur apparaît dans le message d override conscient', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 16 } });
    const msg = formatClearanceForConfirm(v);
    expect(msg).toMatch(/mineure/i);
    expect(msg).toMatch(/override conscient/i);
  });

  it('âge inconnu → badge warn (non bloquant) sur plan propre', () => {
    const v = assertPlanClinicallyCleared(cleanPlan, { form: {} });
    expect(clearanceBadge(v).tone).toBe('warn');
    expect(clearanceBadge(v).blocking).toBe(false);
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

// P1.3 — la porte automatique (transition de phase) stocke le verdict dans le
// brouillon ; le panel l'affiche. `clearanceBadge` traduit un verdict (frais OU
// relu depuis trigger_metadata, potentiellement absent sur vieux drafts) en un
// descripteur d'affichage. Le vrai gate dur reste la re-vérification live à la
// publication (P1.2) — ce badge est informatif.
describe('clearanceBadge — descripteur affichage panel brouillons (P1.3)', () => {
  it('verdict bloquant (cleared:false) → tone block, blocking true', () => {
    const v = assertPlanClinicallyCleared('Snack arachide.', { form: { allergies: 'arachide' } });
    const b = clearanceBadge(v);
    expect(b.tone).toBe('block');
    expect(b.blocking).toBe(true);
  });

  it('verdict avec warnings seuls → tone warn, non bloquant', () => {
    const v = assertPlanClinicallyCleared('Dessert : yaourt au lait entier.', { form: { alimentsEvites: 'lait' } });
    const b = clearanceBadge(v);
    expect(b.tone).toBe('warn');
    expect(b.blocking).toBe(false);
  });

  it('verdict propre → tone ok, non bloquant', () => {
    // age adulte explicite : sinon l'âge absent déclenche le warning age_unknown
    // (détection mineur 2026-06-13) → tone 'warn'. Ici on veut un verdict propre.
    const v = assertPlanClinicallyCleared(cleanPlan, { form: { age: 30 } });
    const b = clearanceBadge(v);
    expect(b.tone).toBe('ok');
    expect(b.blocking).toBe(false);
  });

  it('verdict absent (vieux draft sans clairance stockée) → tone unknown, non bloquant', () => {
    expect(clearanceBadge(null).tone).toBe('unknown');
    expect(clearanceBadge(undefined).tone).toBe('unknown');
    expect(clearanceBadge(null).blocking).toBe(false);
  });
});
