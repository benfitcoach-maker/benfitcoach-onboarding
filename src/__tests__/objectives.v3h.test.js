// V97.4 V3.H Gap #3 — Tests unitaires formatPrioritizedObjectivesFr.
// Date : 2026-05-12
//
// Couverture :
//   - Form vide / null / undefined → ''
//   - Seul l'objectif primaire renseigné → bloc bien formé
//   - 3 objectifs + urgency → bloc complet
//   - Urgency seul (sans objectif) → bloc avec seulement urgency + directive
//   - Strings whitespace-only ignorées (trim)
//   - Urgency code inconnu → ignoré sans crash
//   - Wording prudent (priorité 1, directive structurer, pas de "OBLIGATOIRE")

import { describe, it, expect } from 'vitest';
import { formatPrioritizedObjectivesFr } from '../services/prompts/nutrition/_objectives.fr';

describe('V3.H Gap #3 — formatPrioritizedObjectivesFr', () => {

  it('form null/undefined/non-object → ""', () => {
    expect(formatPrioritizedObjectivesFr(null)).toBe('');
    expect(formatPrioritizedObjectivesFr(undefined)).toBe('');
    expect(formatPrioritizedObjectivesFr('string')).toBe('');
    expect(formatPrioritizedObjectivesFr(42)).toBe('');
  });

  it('aucun champ rempli → ""', () => {
    expect(formatPrioritizedObjectivesFr({})).toBe('');
    expect(formatPrioritizedObjectivesFr({ unrelated: 'x' })).toBe('');
  });

  it('priorité 1 seule → bloc avec P1 + directive', () => {
    const out = formatPrioritizedObjectivesFr({
      objectif_primaire: 'Stabiliser énergie sur la journée',
    });
    expect(out).toContain('OBJECTIFS PRIORISÉS DE LA CLIENTE');
    expect(out).toContain('Priorité 1');
    expect(out).toContain('Stabiliser énergie sur la journée');
    expect(out).not.toContain('Priorité 2');
    expect(out).not.toContain('Niveau d\'urgence');
    expect(out).toMatch(/structure le plan autour de la priorité 1/i);
  });

  it('3 objectifs + urgency → bloc complet', () => {
    const out = formatPrioritizedObjectivesFr({
      objectif_primaire: 'Perte 8 kg',
      objectif_secondaire_1: 'Améliorer sommeil',
      objectif_secondaire_2: 'Réduire ballonnements',
      objectif_urgency: 'moyen_3_6m',
    });
    expect(out).toContain('Priorité 1');
    expect(out).toContain('Perte 8 kg');
    expect(out).toContain('Priorité 2');
    expect(out).toContain('Améliorer sommeil');
    expect(out).toContain('Priorité 3');
    expect(out).toContain('Réduire ballonnements');
    expect(out).toContain('Niveau d\'urgence');
    expect(out).toContain('moyen terme');
  });

  it('urgency seule (sans objectifs) → bloc minimal', () => {
    const out = formatPrioritizedObjectivesFr({
      objectif_urgency: 'urgent_moins_1m',
    });
    expect(out).toContain('OBJECTIFS PRIORISÉS');
    expect(out).toContain('Niveau d\'urgence');
    expect(out).toContain('urgent (résultats attendus < 1 mois)');
    expect(out).toMatch(/structure le plan autour de la priorité 1/i);
  });

  it('whitespace-only ignoré (trim)', () => {
    const out = formatPrioritizedObjectivesFr({
      objectif_primaire: '   ',
      objectif_secondaire_1: '\n\t',
    });
    expect(out).toBe('');
  });

  it('urgency code inconnu → ligne urgency omise (mais bloc présent si autres champs)', () => {
    const out = formatPrioritizedObjectivesFr({
      objectif_primaire: 'Test',
      objectif_urgency: 'inconnu_random',
    });
    expect(out).toContain('Priorité 1');
    expect(out).not.toContain('Niveau d\'urgence');
  });

  it('wording prudent : pas de termes prescriptifs', () => {
    const out = formatPrioritizedObjectivesFr({
      objectif_primaire: 'X',
      objectif_secondaire_1: 'Y',
    });
    expect(out).not.toMatch(/OBLIGATOIRE/i);
    expect(out).not.toMatch(/IMPÉRATIF/i);
    expect(out).not.toMatch(/INTERDIT/i);
  });

  it('long terme renders correctly', () => {
    const out = formatPrioritizedObjectivesFr({
      objectif_primaire: 'X',
      objectif_urgency: 'long_terme',
    });
    expect(out).toContain('long terme');
    expect(out).toContain('transformation durable');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Intégration composer.fr.js : injection objectifs dans le system prompt.
// ═══════════════════════════════════════════════════════════════════

describe('V3.H Gap #3 — intégration composer.fr.js', () => {

  it('composer injecte le bloc objectifs si renseignés', async () => {
    const { composeSystemPromptFr } = await import('../services/prompts/nutrition/composer.fr');
    const result = composeSystemPromptFr(
      {
        objectif_primaire: 'Test objectif primaire',
        objectif_secondaire_1: 'Test secondaire',
      },
      { planMode: 'oneshot' },
    );
    expect(result.blocked).toBe(false);
    expect(result.prompt).toContain('OBJECTIFS PRIORISÉS');
    expect(result.prompt).toContain('Test objectif primaire');
    expect(result.prompt).toContain('═══ OBJECTIFS PRIORISÉS ═══');
  });

  it('composer n\'injecte rien si aucun objectif Gap #3 renseigné', async () => {
    const { composeSystemPromptFr } = await import('../services/prompts/nutrition/composer.fr');
    const result = composeSystemPromptFr(
      { objectifPrincipalNutrition: 'legacy textarea' },
      { planMode: 'oneshot' },
    );
    expect(result.blocked).toBe(false);
    expect(result.prompt).not.toContain('OBJECTIFS PRIORISÉS DE LA CLIENTE');
    expect(result.prompt).not.toContain('═══ OBJECTIFS PRIORISÉS ═══');
  });
});
