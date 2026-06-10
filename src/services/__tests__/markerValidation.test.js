// P1.4 (remède sécurité clinique, 2026-06-10) — validation de plausibilité
// des valeurs labo saisies.
//
// Invariant clé : on détecte l'IMPLAUSIBLE (erreur de saisie : zéro en trop,
// mauvaise unité), PAS l'ANORMAL. Une ferritine à 8 est anormale mais réelle
// → aucun avertissement. Une ferritine à 8000 ou une glycémie à 1000 est une
// faute de frappe probable → avertissement DOUX, non bloquant. Anissa garde la
// main (elle peut confirmer une vraie valeur extrême).
//
// Les plafonds (plausible_max) sont une DONNÉE éditable du catalogue, marquée
// « à valider Anissa » — pas une décision clinique codée par un non-clinicien.
//
// Test ROUGE avant remède (validateMarkerValue n'existe pas) → VERT après.

import { describe, it, expect } from 'vitest';
import { validateMarkerValue } from '../clinical/catalog/markers';

describe('validateMarkerValue — plausibilité de saisie labo (P1.4)', () => {
  it('ferritine 8 (anormal mais réel) → plausible, pas d\'avertissement', () => {
    const r = validateMarkerValue('ferritine', '8');
    expect(r.plausible).toBe(true);
  });

  it('ferritine 8000 (faute de frappe probable) → implausible', () => {
    const r = validateMarkerValue('ferritine', '8000');
    expect(r.plausible).toBe(false);
    expect(r.message).toBeTruthy();
  });

  it('glycémie 1000 → implausible', () => {
    const r = validateMarkerValue('glycemie_jeun', '1000');
    expect(r.plausible).toBe(false);
  });

  it('glycémie 5,2 (décimale française) → plausible', () => {
    const r = validateMarkerValue('glycemie_jeun', '5,2');
    expect(r.plausible).toBe(true);
  });

  it('valeur négative → implausible (faute de saisie)', () => {
    const r = validateMarkerValue('glycemie_jeun', '-3');
    expect(r.plausible).toBe(false);
  });

  it('valeur vide / non numérique → non évaluée, plausible (Anissa garde la main)', () => {
    expect(validateMarkerValue('glycemie_jeun', '').plausible).toBe(true);
    expect(validateMarkerValue('glycemie_jeun', 'non renseigné').plausible).toBe(true);
    expect(validateMarkerValue('candida_albicans', 'présence').plausible).toBe(true);
  });

  it('marqueur sans plafond défini → non évalué, plausible', () => {
    const r = validateMarkerValue('dhea_s', '999999');
    expect(r.plausible).toBe(true);
    expect(r.assessed).toBe(false);
  });

  it('code inconnu → non évalué, plausible (jamais throw)', () => {
    expect(() => validateMarkerValue('inexistant', '42')).not.toThrow();
    expect(validateMarkerValue('inexistant', '42').plausible).toBe(true);
  });
});
