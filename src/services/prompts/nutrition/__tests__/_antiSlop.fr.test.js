// V97.x Phase 3 — Tests des heuristiques anti-slop.
// Cf spec : spec-composer-v97-clinical-antislop.md
//
// Regression Hawazen : le plan original doit déclencher MINIMUM 5 flags.

import { describe, it, expect } from 'vitest';
import {
  detectSlopHeuristics,
  summarizeSlopFlags,
  CATEGORY_LABELS,
} from '../_antiSlop.fr';

describe('detectSlopHeuristics — détecteurs individuels', () => {
  it('Retourne [] si texte vide', () => {
    expect(detectSlopHeuristics('')).toEqual([]);
    expect(detectSlopHeuristics(null)).toEqual([]);
  });

  it('Détecte rule of three dans un titre', () => {
    const plan = 'Axe prioritaire : Stabilité glycémique, gestion du stress et soutien grossesse';
    const flags = detectSlopHeuristics(plan);
    const ruleOfThree = flags.filter((f) => f.category === 'rule_of_three');
    expect(ruleOfThree.length).toBeGreaterThanOrEqual(1);
    expect(ruleOfThree[0].severity).toBe('high');
  });

  it('Détecte vocab AI multiple', () => {
    const plan = `
Protocole de base établi.
Timing adapté à ton rythme.
Indicateurs hebdomadaires à observer.
    `;
    const flags = detectSlopHeuristics(plan);
    const vocab = flags.filter((f) => f.category === 'ai_vocab');
    expect(vocab.length).toBeGreaterThanOrEqual(3);
  });

  it('Détecte métaphore cliché "montagnes russes glycémiques"', () => {
    const plan = 'Tu vas sortir des montagnes russes glycémiques.';
    const flags = detectSlopHeuristics(plan);
    const cliches = flags.filter((f) => f.category === 'cliche');
    expect(cliches.length).toBeGreaterThanOrEqual(1);
    expect(cliches[0].severity).toBe('high');
  });

  it('Détecte métaphore cliché "la base est posée"', () => {
    const plan = 'La base est posée. Tout ce dont ton corps a besoin est là.';
    const flags = detectSlopHeuristics(plan);
    expect(flags.some((f) => f.category === 'cliche' && f.snippet.toLowerCase().includes('la base est posée'))).toBe(true);
  });

  it('Détecte titre "X > Y" en MAJUSCULES', () => {
    const plan = 'NUTRITION > PROTOCOLE DE BASE';
    const flags = detectSlopHeuristics(plan);
    expect(flags.some((f) => f.category === 'title_chevron')).toBe(true);
  });

  it('Détecte excès majuscules dans titre long', () => {
    const plan = 'PROTOCOLE NUTRITIONNEL PERSONNALISÉ POUR HAWAZEN';
    const flags = detectSlopHeuristics(plan);
    expect(flags.some((f) => f.category === 'excess_caps')).toBe(true);
  });

  it('Détecte bullets parallèles Matin / Midi / Soir', () => {
    const plan = `
- Matin : café + tartine
- Midi : salade composée
- Soir : poisson grillé + légumes
    `;
    const flags = detectSlopHeuristics(plan);
    expect(flags.some((f) => f.category === 'parallel_bullets')).toBe(true);
  });

  it('Détecte sections symétriques (4 titres + 3 bullets chacun)', () => {
    const plan = `
PHASE UN
- bullet a
- bullet b
- bullet c

PHASE DEUX
- bullet a
- bullet b
- bullet c

PHASE TROIS
- bullet a
- bullet b
- bullet c

PHASE QUATRE
- bullet a
- bullet b
- bullet c
    `;
    const flags = detectSlopHeuristics(plan);
    expect(flags.some((f) => f.category === 'symmetric_sections')).toBe(true);
  });
});

describe('detectSlopHeuristics — regression Hawazen', () => {
  it('Plan Hawazen-like déclenche minimum 5 flags', () => {
    // Reconstruit un extrait représentatif du plan Hawazen original
    const hawazenPlan = `
AXE PRIORITAIRE > STABILITÉ
Axe prioritaire : Stabilité glycémique, gestion du stress et soutien grossesse.

PROTOCOLE DE BASE
Protocole de base établi pour cette période intense.
Timing adapté à ton rythme.

TON ALIMENTATION
- Matin : flocons d'avoine + fruits rouges
- Midi : poulet + quinoa + légumes vapeur
- Soir : poisson blanc + patate douce
- Collation : amandes + pomme

INDICATEURS HEBDOMADAIRES
Indicateurs hebdomadaires à observer pour de manière optimale ajuster.

CONCLUSION
La base est posée. Ton corps et ton bébé ont maintenant tout ce dont ils ont besoin pour cette période intense.
Tu vas sortir des montagnes russes glycémiques en quelques semaines.
    `;
    const flags = detectSlopHeuristics(hawazenPlan);
    // Doit détecter : rule of three (1), vocab AI (3+), cliches (3+), chevron (1), excess_caps (qq), parallel_bullets (1)
    expect(flags.length).toBeGreaterThanOrEqual(5);

    const categories = new Set(flags.map((f) => f.category));
    expect(categories.has('rule_of_three')).toBe(true);
    expect(categories.has('ai_vocab')).toBe(true);
    expect(categories.has('cliche')).toBe(true);
    expect(categories.has('parallel_bullets')).toBe(true);
  });

  it('Plan clean ne déclenche aucun flag', () => {
    const cleanPlan = `
Hawazen, voici ce qu'on met en place ensemble.

J'ai pris le temps de regarder tes derniers résultats et ton ressenti. Trois choses ressortent : ton transit n'est pas régulier, tu te lèves fatiguée, et ton stress monte le mardi (jour de présentation au travail). On va travailler là-dessus de façon simple.

Pour la digestion, tu vas commencer par boire un grand verre d'eau tiède au réveil. Pas avant. Pas après. Juste ça pendant deux semaines.

Au petit-déj, je te propose des œufs brouillés à la place du yaourt. Tu sentiras la différence en 4-5 jours sur les fringales.

Continue ta supplémentation prescrite. On en reparle en consultation S4.
    `;
    const flags = detectSlopHeuristics(cleanPlan);
    // Tolérance : 0-1 faux positif acceptable
    expect(flags.length).toBeLessThanOrEqual(1);
  });
});

describe('summarizeSlopFlags', () => {
  it('Aggrège par catégorie avec count + severity max', () => {
    const flags = [
      { id: '1', category: 'ai_vocab', severity: 'low' },
      { id: '2', category: 'ai_vocab', severity: 'medium' },
      { id: '3', category: 'cliche', severity: 'high' },
    ];
    const summary = summarizeSlopFlags(flags);
    const vocab = summary.find((s) => s.category === 'ai_vocab');
    expect(vocab.count).toBe(2);
    expect(vocab.severity).toBe('medium'); // max severity entre low et medium

    const cliche = summary.find((s) => s.category === 'cliche');
    expect(cliche.count).toBe(1);
    expect(cliche.severity).toBe('high');
  });
});

describe('CATEGORY_LABELS', () => {
  it('Couvre toutes les catégories utilisées', () => {
    const keys = ['rule_of_three', 'ai_vocab', 'cliche', 'symmetric_sections', 'parallel_bullets', 'title_chevron', 'excess_caps'];
    for (const k of keys) {
      expect(CATEGORY_LABELS[k]).toBeTruthy();
    }
  });
});
