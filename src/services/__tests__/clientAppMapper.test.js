// V95.1 : test de regression pour la fix splitPlanSections.
// Reproduit le format reel produit par l'IA pour la section
// "## 4. ALTERNATIVES PAR REPAS" (verifie sur le plan Melissa du 01-05-2026).
// Sans la fix, splitPlanSections coupait sur les ### → meal.alternatives vide.

import { describe, it, expect } from 'vitest';
import { buildClientAppPlanFromConsultation } from '../clientAppMapper';

const MELISSA_LIKE_PLAN = `## 0. INTRODUCTION PERSONNALISEE

Mélissa, ta situation mêle plusieurs axes : un diabète T1 a stabiliser, une
digestion fragile et un stress haut. On y va doucement, etape par etape.

## 1. ANALYSE DU PROFIL

Objectif principal : Stabiliser la glycemie
Probleme principal : Variations brutales
Facteurs bloquants : Stress, sommeil fragmente
Niveau de difficulte du plan : Modere

## 2. STRATEGIE NUTRITIONNELLE

Axe principal : Reduire la charge glucidique du soir pour stabiliser la glycemie nocturne
Structure alimentaire imposee : 3 repas equilibres + 1 collation, jamais de saut de repas
Priorites d'action : Densifier les proteines au petit-dejeuner, reduire les sucres rapides
Ajustements cles : Reintroduction progressive des feculents complets selon tolerance

## 3. SEMAINE 1 — STRUCTURE ALIMENTAIRE

Petit-dejeuner : 1 oeuf + 1 tranche pain complet (40g) + 1/4 avocat + 30g fromage blanc + tisane verveine
Dejeuner : 100g cabillaud + 60g quinoa cuit + courgettes vapeur + 1 c.s. huile olive + salade verte
Collation : 125g yaourt grec + 20g amandes + 1 c.c. miel
Diner : 80g blanc de poulet + 120g brocolis vapeur + 1 petite patate douce (80g) + tisane camomille

## 4. ALTERNATIVES PAR REPAS

### Petit-dejeuner
- Porridge sarrasin & cannelle — 40g flocons, lait amande, 1 c.c. cannelle
- Smoothie epinards & avocat — 200ml lait vegetal, 1/4 avocat, epinards frais
- Yaourt soja & graines — 150g yaourt soja, 1 c.s. graines tournesol, myrtilles
- Oeufs brouilles & legumes — 2 oeufs, courgettes sautees, herbes fraiches

### Dejeuner
- Saumon vapeur & legumineuses — 100g saumon, 80g lentilles vertes, epinards
- Tofu marine & riz complet — 120g tofu, 60g riz complet, ratatouille
- Lieu noir & patate douce — 120g lieu noir, patate douce rotie, haricots verts
- Dinde aux herbes & cereales — 100g escalope dinde, 60g epeautre, champignons

### Collation
- Compote & oleagineux — compote sans sucre, 25g noix
- Hummus & legumes — 2 c.s. hummus, batonnets concombre
- Ricotta & graines — 100g ricotta, 1 c.s. graines lin

### Diner
- Cabillaud & legumes vapeur — 100g cabillaud, julienne legumes, huile olive
- Oeufs au plat & salade — 2 oeufs, salade composee, vinaigrette legere
- Tofu soyeux & soupe — 100g tofu, bouillon legumes maison
- Blanc de volaille & puree — 80g escalope, puree butternut sans beurre

## 5. FICHE FRIGO

- Toujours proteines + fibres avant les glucides
- Jamais de fruit seul

## 6. PROTOCOLES CIBLES

Pour stabiliser ta glycemie : commence par les legumes a chaque repas.
`;

describe('buildClientAppPlanFromConsultation — V95 alternatives flow', () => {

  it('Plan Melissa-like : alternatives populees sur tous les slots', () => {
    const client = { prenom: 'Melissa', langue: 'FR' };
    const consultation = {
      id: 'test-consult-1',
      nutrition_plan: MELISSA_LIKE_PLAN,
      supplements: '',
    };

    const plan = buildClientAppPlanFromConsultation(client, consultation);
    const lundi = plan.sections.week_meals.days[0];

    // 4 repas par jour : breakfast, lunch, snack, dinner
    expect(lundi.meals.length).toBeGreaterThanOrEqual(3);

    // Chaque meal doit avoir alternatives populees (3-4 selon le slot)
    const breakfast = lundi.meals.find((m) => m.slot === 'breakfast');
    const lunch = lundi.meals.find((m) => m.slot === 'lunch');
    const snack = lundi.meals.find((m) => m.slot === 'afternoon_snack');
    const dinner = lundi.meals.find((m) => m.slot === 'dinner');

    expect(breakfast?.alternatives?.length).toBe(4);
    expect(lunch?.alternatives?.length).toBe(4);
    expect(snack?.alternatives?.length).toBe(3);
    expect(dinner?.alternatives?.length).toBe(4);
  });

  it('Alternative bien structuree : title + hint extraits', () => {
    const client = { prenom: 'Melissa', langue: 'FR' };
    const consultation = {
      id: 'test-consult-2',
      nutrition_plan: MELISSA_LIKE_PLAN,
      supplements: '',
    };

    const plan = buildClientAppPlanFromConsultation(client, consultation);
    const breakfast = plan.sections.week_meals.days[0].meals.find(
      (m) => m.slot === 'breakfast',
    );
    const firstAlt = breakfast.alternatives[0];

    expect(firstAlt.title).toBe('Porridge sarrasin & cannelle');
    expect(firstAlt.hint).toMatch(/40g flocons/);
    expect(firstAlt.id).toBeTruthy();
  });

  it('Plan sans section ALTERNATIVES : meal.alternatives reste undefined (backward compat)', () => {
    const client = { prenom: 'Test', langue: 'FR' };
    const planWithoutAlts = `## 3. SEMAINE 1 — STRUCTURE ALIMENTAIRE

Petit-dejeuner : 1 oeuf + 1 tranche pain
Dejeuner : 100g cabillaud + 60g quinoa
Diner : 80g poulet + 120g brocolis
`;
    const consultation = {
      id: 'test-consult-3',
      nutrition_plan: planWithoutAlts,
      supplements: '',
    };

    const plan = buildClientAppPlanFromConsultation(client, consultation);
    const meals = plan.sections.week_meals.days[0].meals;

    for (const m of meals) {
      expect(m.alternatives).toBeUndefined();
    }
  });
});
