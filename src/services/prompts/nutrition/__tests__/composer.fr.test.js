// V96.27 — Tests unitaires composer FR + buildSystemPromptFrV2 (OPT-IN).
// Couvre l'assemblage du system prompt, le cap modules, et le wrapper OPT-IN.

import { describe, it, expect } from 'vitest';
import { composeSystemPromptFr } from '../composer.fr';
import { buildSystemPromptFrV2, buildSystemPromptFr } from '../fr';

const baseFemme = (overrides = {}) => ({
  prenom: 'Test',
  genre: 'F',
  age: 35,
  ...overrides,
});

// ─── COMPOSER : ASSEMBLAGE BASIQUE ────────────────────────────────

describe('composeSystemPromptFr — assemblage', () => {
  it('Retourne shape { prompt, profile, blocked }', () => {
    const r = composeSystemPromptFr(baseFemme(), {});
    expect(r).toHaveProperty('prompt');
    expect(r).toHaveProperty('profile');
    expect(r).toHaveProperty('blocked');
    expect(typeof r.prompt).toBe('string');
    expect(r.blocked).toBe(false);
  });

  it('Inclut SYSTEM_PROMPT_FR + SWISS_BRANDS_PROMPT_FR en base', () => {
    const r = composeSystemPromptFr(baseFemme(), {});
    expect(r.prompt).toContain('Anissa');  // identite
    expect(r.prompt).toContain('Suisse');   // contexte suisse
  });

  it('Inclut SUPPLEMENT_PROMPT_FR si pretProtocole = Oui', () => {
    const r = composeSystemPromptFr(baseFemme({ pretProtocole: 'Oui' }), {});
    expect(r.prompt).toContain('SUPPLEMENTS RECOMMANDES');
  });

  it('Pas de supplements si pretProtocole vide ou Non', () => {
    const r = composeSystemPromptFr(baseFemme({ pretProtocole: 'Non' }), {});
    expect(r.prompt).not.toContain('SUPPLEMENTS RECOMMANDES');
  });
});

// ─── COMPOSER : INJECTION DE MODULES PROFIL ──────────────────────

describe('composeSystemPromptFr — modules profil', () => {
  it('Profil simple femmeCycle injecte le module femme', () => {
    const r = composeSystemPromptFr(baseFemme({ age: 30 }), {});
    expect(r.profile.primary).toBe('femmeCycle');
    expect(r.prompt).toContain('CYCLE FEMININ');
  });

  it('Diabete + complications => 2 modules injectes', () => {
    const r = composeSystemPromptFr(baseFemme({
      pathologies: 'diabete T1, retinopathie',
    }), {});
    expect(r.profile.all).toContain('diabete');
    expect(r.profile.all).toContain('complicationsDiabete');
    expect(r.prompt).toContain('DIABETE');
    expect(r.prompt).toContain('COMPLICATIONS');
  });

  it('Pas d\'injection de modules profil si profile vide', () => {
    const r = composeSystemPromptFr({ genre: 'Homme', age: 35 }, {});
    // Homme adulte sans pathologies = aucun module
    expect(r.profile.primary).toBe(null);
    expect(r.profile.pathologies.length).toBe(0);
    expect(r.prompt).not.toContain('═══ MODULES PROFIL CLIENT ═══');
  });

  it('Marqueur de section MODULES PROFIL inclus si modules detectes', () => {
    const r = composeSystemPromptFr(baseFemme({
      pathologies: 'diabete T1',
    }), {});
    expect(r.prompt).toContain('═══ MODULES PROFIL CLIENT ═══');
  });
});

// ─── COMPOSER : CAP A 8 MODULES ──────────────────────────────────

describe('composeSystemPromptFr — cap 8 modules', () => {
  it('Cap les modules injectes a 8 max meme si plus de tags', () => {
    // On force un profil ultra-comorbide
    const r = composeSystemPromptFr(baseFemme({
      age: 30,  // primary = femmeCycle
      pathologies: 'diabete T2, retinopathie, SII, hashimoto, sopk, TDAH, endometriose',
      niveauStressActuel: 9,  // burn-out
      projetGrossesse: 'Oui',  // preConceptionFertilite
    }), {});
    // Le cap composer est 8 modules. On verifie via profile.all qui est la
    // source de verite du detecteur (cap 7 patho + 1 primary), puis le
    // composer slice(0, 8) avant injection. Le bloc "MODULES PROFIL CLIENT"
    // contient donc au plus 8 modules.
    expect(r.profile.all.length).toBeLessThanOrEqual(8);
    // Verifier que le marqueur de section est bien present
    if (r.profile.all.length > 0) {
      expect(r.prompt).toContain('═══ MODULES PROFIL CLIENT ═══');
    }
  });
});

// ─── COMPOSER : MODE PLAN (oneshot vs followup vs 4weeks) ────────

describe('composeSystemPromptFr — plan mode', () => {
  it('Mode oneshot ajoute ONESHOT_PLAN_PROMPT_FR', () => {
    const r = composeSystemPromptFr(baseFemme(), { planMode: 'oneshot' });
    expect(r.prompt).toMatch(/ONE-?SHOT/i);
  });

  it('Mode followup avec week 1 ajoute le followup prompt', () => {
    const r = composeSystemPromptFr(baseFemme(), {
      isFollowup: true, followupWeek: 1,
    });
    expect(r.prompt).toMatch(/SEMAINE 1/);
  });

  it('Formule "suivi" + non-followup ajoute FOUR_WEEKS_PROMPT_FR', () => {
    const r = composeSystemPromptFr(baseFemme(), {
      clientFormule: 'suivi',
    });
    expect(r.prompt).toMatch(/PLAN D'ACTION \(4 SEMAINES\)/);
  });
});

// ─── BUILDER V2 OPT-IN : DELEGATION OU COMPOSER ──────────────────

describe('buildSystemPromptFrV2 — wrapper OPT-IN', () => {
  it('Sans option useComposer : delegue a buildSystemPromptFr (legacy)', () => {
    const v2 = buildSystemPromptFrV2(baseFemme(), {});
    const legacy = buildSystemPromptFr(baseFemme(), {});
    expect(v2.prompt).toBe(legacy);
    expect(v2.profile).toBe(null);
    expect(v2.blocked).toBe(false);
  });

  it('Avec useComposer: true : utilise le composer (modules profils)', () => {
    const r = buildSystemPromptFrV2(baseFemme({
      pathologies: 'diabete T1',
    }), {}, { useComposer: true });
    expect(r.profile).not.toBeNull();
    expect(r.profile.all).toContain('diabete');
    expect(r.prompt).toContain('DIABETE');
  });

  it('useComposer: false explicite = legacy egalement', () => {
    const r = buildSystemPromptFrV2(baseFemme({
      pathologies: 'diabete T1',
    }), {}, { useComposer: false });
    expect(r.profile).toBe(null);
    // Le path legacy NE contient PAS le module diabete dedie (juste les regles generales)
    expect(r.prompt).not.toContain('═══ MODULES PROFIL CLIENT ═══');
  });
});

// ─── ROBUSTESSE ───────────────────────────────────────────────────

describe('composeSystemPromptFr — robustesse', () => {
  it('Form vide ne crash pas', () => {
    const r = composeSystemPromptFr({}, {});
    expect(r).toBeDefined();
    expect(typeof r.prompt).toBe('string');
  });

  it('Form null ne crash pas', () => {
    expect(() => composeSystemPromptFr(null, {})).not.toThrow();
  });

  it('Opts vides ne crash pas', () => {
    expect(() => composeSystemPromptFr(baseFemme(), {})).not.toThrow();
  });
});
