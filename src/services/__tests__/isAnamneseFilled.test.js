// P1.1 (remède sécurité clinique, 2026-06-10) — gate anamnèse vide.
//
// Quand le pré-questionnaire est sauté (form = {}), analyzeAnamnese renvoie des
// structures vides et la génération IA (résumé médecin, plan) bâtit un document
// d'apparence sérieuse sur rien — un mensonge d'interface. Le remède exige une
// SOURCE UNIQUE de vérité `isAnamneseFilled(form)`, utilisée partout où la
// complétude est jugée (remplace la détection inline `minimallyFilled` de
// ClientJourneyPage), pour armer / désarmer le gate de génération.
//
// Ici on teste la DÉCISION (fonction pure). Le câblage React (bannière rouge +
// bouton désactivé + case « générer quand même ») est vérifié à la lecture —
// le projet n'a pas d'infra de rendu de composant (node env, fonctions pures).
//
// Test ROUGE avant remède (isAnamneseFilled n'existe pas) → VERT après.

import { describe, it, expect } from 'vitest';
import { isAnamneseFilled } from '../anamneseAnalyzer';

describe('isAnamneseFilled — source unique de complétude anamnèse (P1.1)', () => {
  it('false sur form vide / null / undefined / non-objet', () => {
    expect(isAnamneseFilled({})).toBe(false);
    expect(isAnamneseFilled(null)).toBe(false);
    expect(isAnamneseFilled(undefined)).toBe(false);
    expect(isAnamneseFilled('nope')).toBe(false);
  });

  it('false si seuls des champs non essentiels sont présents', () => {
    expect(isAnamneseFilled({ prenom: 'Camille', email: 'c@x.ch' })).toBe(false);
  });

  it('true dès qu un champ essentiel du pré-questionnaire est rempli', () => {
    expect(isAnamneseFilled({ objectif_primaire: 'perte de poids' })).toBe(true);
    expect(isAnamneseFilled({ dureeProbleme: '6 mois' })).toBe(true);
    expect(isAnamneseFilled({ ressentiDigestion: 'ballonnements' })).toBe(true);
    expect(isAnamneseFilled({ energieJournee: 'basse' })).toBe(true);
    expect(isAnamneseFilled({ traitements: 'Sintrom' })).toBe(true);
    expect(isAnamneseFilled({ allergies: 'arachide' })).toBe(true);
    expect(isAnamneseFilled({ contraception: 'pilule' })).toBe(true);
  });

  it('true sur les champs legacy SaaS (saisie manuelle Anissa)', () => {
    expect(isAnamneseFilled({ objectifs: 'x' })).toBe(true);
    expect(isAnamneseFilled({ symptomes: 'x' })).toBe(true);
    expect(isAnamneseFilled({ pathologies: 'x' })).toBe(true);
    expect(isAnamneseFilled({ activite: 'x' })).toBe(true);
  });

  it('ignore les chaînes vides / blanches (pas un faux positif)', () => {
    expect(isAnamneseFilled({ objectif_primaire: '' })).toBe(false);
    expect(isAnamneseFilled({ objectif_primaire: '   ' })).toBe(false);
    expect(isAnamneseFilled({ allergies: '' })).toBe(false);
  });
});
