// Fondation anamnèse V1 (2026-06-13) — injection FR dans le bloc sécurité + prompt.
// Prouve : restrictions (3 natures distinctes) + compléments anti-doublon dans
// buildSafetyBlockFr, et ouverture aux compléments dans buildSystemPromptFr
// (chemin ACTIF composerBeta=false). Distinction d'avec le gate allergène.

import { describe, it, expect } from 'vitest';
import { buildSafetyBlockFr } from '../_clinicalContext.fr';
import { buildSystemPromptFr } from '../fr';

const baseForm = (overrides = {}) => ({ prenom: 'Test', genre: 'F', age: 35, ...overrides });

describe('Restrictions FR — 3 natures distinctes', () => {
  it('Religieux (Halal) : « ne jamais proposer volontairement » + anti-sur-restriction', () => {
    const block = buildSafetyBlockFr(baseForm({ restrictionsAlimentaires: ['halal'] }));
    expect(block).toContain('RESTRICTIONS RELIGIEUSES');
    expect(block).toContain('Halal');
    expect(block).toMatch(/ne jamais proposer volontairement/i);
    // Garde anti-sur-restriction : la phrase doit cadrer, pas faire paniquer l'IA.
    expect(block).toMatch(/ne limitent QUE les aliments incompatibles/i);
    expect(block).toMatch(/ne pas sur-restreindre/i);
  });

  it('Préférence (Végan) : best-effort + gradation « éviter » + anti-sur-restriction végan', () => {
    const block = buildSafetyBlockFr(baseForm({ restrictionsAlimentaires: ['vegan'] }));
    expect(block).toContain('préférence');
    expect(block).toContain('Végan');
    expect(block).toMatch(/autant que possible/i);
    // Gradation Anissa : préférence = « éviter de proposer » (souple), PAS l'absolu
    // religieux « ne jamais proposer ».
    expect(block).toMatch(/éviter de proposer des aliments incompatibles/i);
    expect(block).not.toMatch(/ne jamais proposer/i);
    expect(block).toMatch(/n'exclut QUE les produits animaux/i);
    // Pas la formule religieuse impérative sur une simple préférence.
    expect(block).not.toMatch(/RESTRICTIONS RELIGIEUSES/);
  });

  it('Ramadan (timing, champ dédié ramadanActif) : 5 contraintes fusionnées, PAS « aliment incompatible »', () => {
    const block = buildSafetyBlockFr(baseForm({ ramadanActif: true }));
    expect(block).toContain('RAMADAN');
    // Les 5 contraintes fusionnées (validations Anissa, version scellée).
    expect(block).toMatch(/fenêtre autorisée/i);              // 1. fenêtre
    expect(block).toMatch(/redistribuer les apports sur cette fenêtre/i); // 2. redistribution active
    expect(block).toMatch(/sans diminuer les apports énergétiques/i);
    expect(block).toMatch(/hydratation/i);                    // 3. hydratation
    expect(block).toMatch(/hypocaloriques agressives/i);      // 4. anti-hypocalorique
    expect(block).toMatch(/jamais ajouter de jeûne supplémentaire/i); // 5. pas de jeûne en plus
    // Ramadan ne déclenche PAS la phrase d'exclusion religieuse.
    expect(block).not.toMatch(/ne jamais proposer volontairement un aliment incompatible/i);
  });

  it('Le code legacy « ramadan » dans restrictionsAlimentaires NE déclenche PAS la ligne Ramadan', () => {
    const block = buildSafetyBlockFr(baseForm({ restrictionsAlimentaires: ['ramadan'] }));
    expect(block).not.toContain('RAMADAN');
  });

  it('restrictionsAutre (texte libre) classé en préférence', () => {
    const block = buildSafetyBlockFr(baseForm({ restrictionsAutre: 'pas de crustacés' }));
    expect(block).toContain('préférence');
    expect(block).toContain('pas de crustacés');
  });

  it('Cumul des 3 natures (religieux + préférence + Ramadan dédié) : lignes distinctes', () => {
    const block = buildSafetyBlockFr(baseForm({ restrictionsAlimentaires: ['casher', 'vegetarien'], ramadanActif: true }));
    expect(block).toContain('RESTRICTIONS RELIGIEUSES');
    expect(block).toContain('Casher');
    expect(block).toContain('RAMADAN');
    expect(block).toContain('Végétarien');
  });
});

describe('Restrictions FR — distinctes du gate allergène', () => {
  it('Allergène reste sur sa ligne « À EXCLURE STRICTEMENT », la restriction sur la sienne', () => {
    const block = buildSafetyBlockFr(baseForm({ allergies: 'arachide', restrictionsAlimentaires: ['vegan'] }));
    expect(block).toMatch(/ALLERGÈNES déclarés — À EXCLURE STRICTEMENT : arachide/);
    expect(block).toContain('RESTRICTIONS ALIMENTAIRES (préférence)');
  });
});

describe('Compléments actuels FR — anti-doublon (contexte IA)', () => {
  it('Injecte la liste + consigne anti-doublon dans le bloc sécurité', () => {
    const block = buildSafetyBlockFr(baseForm({ complementsActuels: [{ nom: 'Vitamine D', dose: '1000 UI' }] }));
    expect(block).toContain('COMPLÉMENTS déjà pris');
    expect(block).toContain('Vitamine D (1000 UI)');
    expect(block).toMatch(/ne pas recommander de doublon/i);
  });

  it('Présent dans le prompt assemblé (chemin actif buildSystemPromptFr)', () => {
    const prompt = buildSystemPromptFr(baseForm({ complementsActuels: [{ nom: 'Magnésium', dose: '300 mg' }] }), {});
    expect(prompt).toContain('Magnésium (300 mg)');
    expect(prompt).toMatch(/ne pas recommander de doublon/i);
  });
});

describe('Ouverture compléments FR — directive souple (hors bloc sécurité)', () => {
  it('« éviter » → privilégier l\'alimentation', () => {
    const prompt = buildSystemPromptFr(baseForm({ ouvertureComplements: 'eviter' }), {});
    expect(prompt).toContain('OUVERTURE AUX COMPLÉMENTS');
    expect(prompt).toMatch(/préfère éviter/i);
    expect(prompt).toMatch(/réellement essentiel/i);
  });

  it('« à l\'aise » → propositions bienvenues', () => {
    const prompt = buildSystemPromptFr(baseForm({ ouvertureComplements: 'a_laise' }), {});
    expect(prompt).toMatch(/à l'aise avec les compléments/i);
    expect(prompt).toMatch(/bienvenues/i);
  });

  it('Non renseignée → aucune directive d\'ouverture', () => {
    const prompt = buildSystemPromptFr(baseForm(), {});
    expect(prompt).not.toContain('OUVERTURE AUX COMPLÉMENTS');
  });
});

describe('Non-régression : form sans champ fondation', () => {
  it('buildSafetyBlockFr vide si rien (pas de bloc vide forcé)', () => {
    expect(buildSafetyBlockFr(baseForm())).toBe('');
  });
});
