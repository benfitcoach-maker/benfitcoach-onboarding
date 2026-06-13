// Fondation anamnèse V1 (2026-06-13) — séparation allergie / intolérance.
//
// CONSTAT : la séparation existe DÉJÀ côté SaaS, sur les deux contrôles :
//   préventif  → buildSafetyBlockFr : `allergies` = ligne « À EXCLURE
//                STRICTEMENT » (force max) ; `alimentsEvites` = ligne « à éviter »
//                (force moindre).
//   détectif   → clinicalClearance : `allergies` → violation HIGH (bloquant) ;
//                `alimentsEvites` → warning LOW (non bloquant).
//
// ADAPTATEUR DE TRANSITION (un NON-ACTE, documenté ici) :
//   Les clientes pré-V1 (et le pré-questionnaire in-app actuel) replient
//   allergies + intolérances dans le SEUL champ `allergies`. Décision figée :
//   ces données restent traitées en STRICT/HIGH. On NE reclasse JAMAIS
//   rétroactivement une valeur de `allergies` vers `alimentsEvites` (= warning).
//   Sur-sécurité conservatrice : mieux vaut bloquer une intolérance par excès
//   que laisser passer un allergène. Aucune migration de données.
//
// Ces tests gravent ce contrat pour qu'un refactor futur ne le casse pas.

import { describe, it, expect } from 'vitest';
import { buildSafetyBlockFr } from '../_clinicalContext.fr';
import { assertPlanClinicallyCleared } from '../../../clinicalClearance';

const baseForm = (overrides = {}) => ({ prenom: 'Test', genre: 'F', age: 35, ...overrides });

describe('Préventif — lecture séparée dans buildSafetyBlockFr', () => {
  it('allergies → « À EXCLURE STRICTEMENT » ; alimentsEvites → « à éviter » (lignes distinctes)', () => {
    const block = buildSafetyBlockFr(baseForm({ allergies: 'arachide', alimentsEvites: 'lactose' }));
    expect(block).toMatch(/ALLERGÈNES déclarés — À EXCLURE STRICTEMENT : arachide/);
    expect(block).toMatch(/Intolérances \/ aliments à éviter : lactose/);
    // Deux forces distinctes : l'intolérance ne porte pas « STRICTEMENT ».
    expect(block).not.toMatch(/lactose.*STRICTEMENT/s);
  });
});

describe('Détectif — sévérités distinctes dans clinicalClearance', () => {
  it('Allergène dans le plan → violation HIGH (cleared:false)', () => {
    const verdict = assertPlanClinicallyCleared('Menu : salade avec arachide grillée.', {
      form: baseForm({ allergies: 'arachide' }),
    });
    expect(verdict.cleared).toBe(false);
    expect(verdict.violations.some((v) => v.type === 'allergen')).toBe(true);
  });

  it('Intolérance dans le plan → warning LOW (cleared:true)', () => {
    const verdict = assertPlanClinicallyCleared('Petit-déjeuner : yaourt au lactose.', {
      form: baseForm({ alimentsEvites: 'lactose' }),
    });
    expect(verdict.cleared).toBe(true);
    expect(verdict.warnings.some((w) => w.type === 'intolerance')).toBe(true);
    expect(verdict.violations.some((v) => v.type === 'allergen')).toBe(false);
  });
});

describe('Adaptateur transition — legacy `allergies` reste STRICT, zéro reclassement', () => {
  it('Donnée repliée dans allergies → HIGH bloquant (jamais downgradée en warning)', () => {
    // Cliente legacy : « lactose » a été saisi dans allergies (champ unique pré-V1).
    const verdict = assertPlanClinicallyCleared('Dessert : crème au lactose.', {
      form: baseForm({ allergies: 'lactose' }),
    });
    // Traité en allergène HIGH, PAS en intolérance LOW.
    expect(verdict.cleared).toBe(false);
    expect(verdict.violations.some((v) => v.type === 'allergen')).toBe(true);
    expect(verdict.warnings.some((w) => w.type === 'intolerance')).toBe(false);
  });
});
