// P2.3 (remède sécurité clinique, 2026-06-10) — rendre la PROFONDEUR
// d'échantillon visible derrière la suggestion de transition de phase.
//
// Invariant (type C bien soigné) : la suggestion d'AVANCER le protocole
// s'appuie sur N ressentis positifs récents, mais ne DISAIT pas N. Anissa doit
// décider en voyant SUR QUOI elle décide. Remède = transparence, PAS
// verrouillage : on n'augmente pas le seuil (décision clinique d'Anissa), on
// expose seulement le nombre qui fonde la suggestion.
//
// Test ROUGE avant remède (feedbackSampleDepth n'existe pas) → VERT après.

import { describe, it, expect } from 'vitest';
import {
  countRecentPositiveFeedbacks,
  formatPositiveSampleBasis,
} from '../feedbackSampleDepth';

describe("countRecentPositiveFeedbacks — profondeur d'échantillon (P2.3)", () => {
  const now = new Date('2026-06-10T12:00:00Z').getTime();
  const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

  it('compte les ressentis positifs dans la fenêtre 7 jours', () => {
    const fb = [
      { created_at: daysAgo(1), digestion: 'better' },
      { created_at: daysAgo(2), fatigue: 'better' },
      { created_at: daysAgo(3), energie: 'good' },
    ];
    expect(countRecentPositiveFeedbacks(fb, { now })).toBe(3);
  });

  it('exclut les ressentis hors fenêtre (≠ verrouillage, juste comptage honnête)', () => {
    const fb = [
      { created_at: daysAgo(1), digestion: 'better' },
      { created_at: daysAgo(10), fatigue: 'better' }, // hors 7j
    ];
    expect(countRecentPositiveFeedbacks(fb, { now })).toBe(1);
  });

  it('exclut les ressentis non positifs', () => {
    const fb = [
      { created_at: daysAgo(1), digestion: 'worse' },
      { created_at: daysAgo(1), fatigue: 'same' },
      { created_at: daysAgo(1), energie: 'low' },
      { created_at: daysAgo(1), digestion: 'better' },
    ];
    expect(countRecentPositiveFeedbacks(fb, { now })).toBe(1);
  });

  it('sans created_at → exclu (impossible de situer dans la fenêtre)', () => {
    const fb = [{ digestion: 'better' }];
    expect(countRecentPositiveFeedbacks(fb, { now })).toBe(0);
  });

  it('entrée non tableau / vide → 0 (jamais throw)', () => {
    expect(countRecentPositiveFeedbacks(null)).toBe(0);
    expect(countRecentPositiveFeedbacks(undefined)).toBe(0);
    expect(countRecentPositiveFeedbacks([])).toBe(0);
    expect(() => countRecentPositiveFeedbacks()).not.toThrow();
  });
});

describe('formatPositiveSampleBasis — base visible (P2.3)', () => {
  it('affiche « sur la base de N ressenti(s) » (singulier / pluriel)', () => {
    expect(formatPositiveSampleBasis(1)).toBe('sur la base de 1 ressenti positif cette semaine');
    expect(formatPositiveSampleBasis(2)).toContain('sur la base de 2 ressentis');
  });

  it('0 ou négatif → chaîne vide (rien à afficher, pas de « 0 ressenti »)', () => {
    expect(formatPositiveSampleBasis(0)).toBe('');
    expect(formatPositiveSampleBasis(-1)).toBe('');
  });
});
