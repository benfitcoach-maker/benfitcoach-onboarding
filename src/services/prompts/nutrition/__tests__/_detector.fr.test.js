// V96.27 — Tests unitaires detecteur composer FR.
// Couvre les 20 modules cliniques actifs + cap pathologies + ordre de priorite
// (clostridiumDifficile en tete + heuristiques T1 ancien / T1 + complications).
//
// Run : npm test

import { describe, it, expect } from 'vitest';
import { detectClientProfile } from '../profiles/_detector.fr';

// ─── Helpers ─────────────────────────────────────────────────────

const baseFemme = (overrides = {}) => ({
  prenom: 'Test',
  genre: 'F',
  age: 35,
  ...overrides,
});

const baseHomme = (overrides = {}) => ({
  prenom: 'Test',
  genre: 'Homme',
  age: 35,
  ...overrides,
});

// ─── PRIMARY PROFILES (1 max par cliente) ────────────────────────

describe('detectClientProfile — primary female profiles', () => {
  it('Femme jeune sans pathologies maternelles -> femmeCycle', () => {
    const r = detectClientProfile(baseFemme({ age: 30 }));
    expect(r.primary).toBe('femmeCycle');
    expect(r.blocked).toBe(false);
  });

  it('Grossesse via champ structure (grossesseActuelle = "Oui")', () => {
    const r = detectClientProfile(baseFemme({ age: 30, grossesseActuelle: 'Oui' }));
    expect(r.primary).toBe('grossesse');
    expect(r.blocked).toBe(false);
  });

  it('Grossesse detectee via texte libre dans pathologies', () => {
    const r = detectClientProfile(baseFemme({ age: 30, pathologies: 'enceinte trimestre 2' }));
    expect(r.primary).toBe('grossesse');
  });

  it('Allaitement via champ structure', () => {
    const r = detectClientProfile(baseFemme({ age: 32, allaitement: 'Oui' }));
    expect(r.primary).toBe('allaitement');
  });

  it('Post-partum via champ structure', () => {
    const r = detectClientProfile(baseFemme({ age: 33, postPartum: 'Oui' }));
    expect(r.primary).toBe('postPartum');
  });

  it('Grossesse PRIORITAIRE sur allaitement si les 2 sont declares', () => {
    const r = detectClientProfile(baseFemme({
      age: 32, grossesseActuelle: 'Oui', allaitement: 'Oui',
    }));
    expect(r.primary).toBe('grossesse');
  });

  it('Menopause via age + cycle absent + derniere regle > 12 mois', () => {
    const r = detectClientProfile(baseFemme({
      age: 54, cycleRegulier: 'non', derniereRegle: 'plus_12_mois',
    }));
    expect(r.primary).toBe('menopause');
  });

  it('Menopause via flag explicite (peu importe age)', () => {
    const r = detectClientProfile(baseFemme({ age: 48, menopause: 'oui' }));
    expect(r.primary).toBe('menopause');
  });

  it('Perimenopause via flag explicite', () => {
    const r = detectClientProfile(baseFemme({ age: 47, perimenopause: 'oui' }));
    expect(r.primary).toBe('perimenopause');
  });

  it('Perimenopause via age 40-55 + 2+ signes hormonaux', () => {
    const r = detectClientProfile(baseFemme({
      age: 48, bouffeesChaleur: 'oui', troubleSommeil: 'oui',
    }));
    expect(r.primary).toBe('perimenopause');
  });

  it('Femme reproductive 18-50 par defaut -> femmeCycle', () => {
    expect(detectClientProfile(baseFemme({ age: 25 })).primary).toBe('femmeCycle');
    expect(detectClientProfile(baseFemme({ age: 38 })).primary).toBe('femmeCycle');
  });

  it('Date de naissance prioritaire sur age (V96.18)', () => {
    // Date de naissance qui correspond a 30 ans environ
    const dob = new Date(Date.now() - 30 * 365.25 * 24 * 3600 * 1000)
      .toISOString().slice(0, 10);
    const r = detectClientProfile(baseFemme({
      age: 99,  // ignore au profit de la dateNaissance
      dateNaissance: dob,
    }));
    expect(r.primary).toBe('femmeCycle');  // ~30 ans, pas menopause
  });

  it('Homme adulte -> aucun primary', () => {
    const r = detectClientProfile(baseHomme({ age: 35 }));
    expect(r.primary).toBe(null);
  });

  it('Genre vide -> traite comme femme par defaut (compat)', () => {
    const r = detectClientProfile({ age: 30 });
    expect(r.primary).toBe('femmeCycle');
  });
});

// ─── PATHOLOGY PROFILES (additifs, cap 5) ────────────────────────

describe('detectClientProfile — pathologies', () => {
  it('Diabete T1 detecte', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'diabete T1' }));
    expect(r.pathologies).toContain('diabete');
  });

  it('Diabete T2', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'diabete type 2' }));
    expect(r.pathologies).toContain('diabete');
  });

  it('Insulinoresistance via objectif', () => {
    const r = detectClientProfile(baseFemme({
      objectifPrincipalNutrition: 'reguler ma glycemie',
    }));
    expect(r.pathologies).toContain('diabete');
  });

  it('complicationsDiabete uniquement si diabete deja detecte', () => {
    const noDiabete = detectClientProfile(baseFemme({ pathologies: 'retinopathie' }));
    expect(noDiabete.pathologies).not.toContain('complicationsDiabete');

    const avecDiabete = detectClientProfile(baseFemme({
      pathologies: 'diabete T1, retinopathie severe',
    }));
    expect(avecDiabete.pathologies).toContain('complicationsDiabete');
  });

  it('Digestif chronique via SII', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'SII modere' }));
    expect(r.pathologies).toContain('digestifChronique');
  });

  it('Digestif chronique via ballonnements <= 2', () => {
    const r = detectClientProfile(baseFemme({ frequenceBallonnements: 1 }));
    expect(r.pathologies).toContain('digestifChronique');
  });

  it('Clostridium difficile EN TETE des pathologies (priorite max)', () => {
    const r = detectClientProfile(baseFemme({
      pathologies: 'diabete T2, clostridium difficile recidive',
    }));
    expect(r.pathologies[0]).toBe('clostridiumDifficile');
  });

  it('Nephropathie via mot-cle direct', () => {
    const r = detectClientProfile(baseFemme({
      pathologies: 'nephropathie diabetique stade 2',
    }));
    expect(r.pathologies).toContain('nephropathie');
  });

  it('Nephropathie suspectee via T1 + complications microvasculaires (V96.16)', () => {
    const r = detectClientProfile(baseFemme({
      pathologies: 'diabete type 1, retinopathie, calcifications',
    }));
    expect(r.pathologies).toContain('nephropathie');
  });

  it('SAOS via mot-cle apnee', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'apnee du sommeil severe' }));
    expect(r.pathologies).toContain('saos');
  });

  it('SAOS detecte aussi dans objectif (multi-champs V96.15)', () => {
    const r = detectClientProfile(baseFemme({
      objectifPrincipalNutrition: 'perdre du poids car hapnee du sommeil niveau 3',
    }));
    expect(r.pathologies).toContain('saos');
  });

  // V96.26 nouveaux modules

  it('performanceSportif via objectif performance', () => {
    const r = detectClientProfile(baseFemme({
      objectifPrincipalNutrition: 'performance marathon',
    }));
    expect(r.pathologies).toContain('performanceSportif');
  });

  it('Thyroide via Hashimoto', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'hashimoto + Levothyrox' }));
    expect(r.pathologies).toContain('thyroide');
  });

  it('Burn-out via mot-cle', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'burn-out 2024' }));
    expect(r.pathologies).toContain('burnoutCortisol');
  });

  it('Burn-out via stress eleve >= 8/10', () => {
    const r = detectClientProfile(baseFemme({ niveauStressActuel: 9 }));
    expect(r.pathologies).toContain('burnoutCortisol');
  });

  it('preConceptionFertilite via projetGrossesse Oui', () => {
    const r = detectClientProfile(baseFemme({ projetGrossesse: 'Oui' }));
    expect(r.pathologies).toContain('preConceptionFertilite');
  });

  it('preConceptionFertilite via PMA dans pathologies', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'parcours FIV en cours' }));
    expect(r.pathologies).toContain('preConceptionFertilite');
  });

  it('SPM via spm = oui', () => {
    const r = detectClientProfile(baseFemme({ spm: 'oui severe' }));
    expect(r.pathologies).toContain('spm');
  });

  it('SPM via douleurs menstruelles fortes', () => {
    const r = detectClientProfile(baseFemme({ douleursMenstruelles: 'fort regulier' }));
    expect(r.pathologies).toContain('spm');
  });

  it('Endometriose via mot-cle', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'endometriose stade 3' }));
    expect(r.pathologies).toContain('endometriose');
  });

  it('SOPK via mot-cle', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'SOPK confirme' }));
    expect(r.pathologies).toContain('sopk');
  });

  it('SOPK via PCOS (anglais)', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'PCOS diagnostic 2023' }));
    expect(r.pathologies).toContain('sopk');
  });

  it('TDAH via mot-cle', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'TDAH adulte' }));
    expect(r.pathologies).toContain('tdah');
  });
});

// ─── CAP PATHOLOGIES + ORDRE PRIORITAIRE ─────────────────────────

describe('detectClientProfile — cap pathologies (V96.26 = 7 max apres slice)', () => {
  it('Cap pathologies a 7 si plus de tags detectes', () => {
    const r = detectClientProfile(baseFemme({
      // 8+ pathologies declenchees pour tester le cap
      pathologies: 'diabete T2, retinopathie, SII, hashimoto, sopk, TDAH, endometriose, apnee sommeil',
      niveauStressActuel: 9,  // burn-out aussi
    }));
    expect(r.pathologies.length).toBeLessThanOrEqual(7);
  });

  it('clostridiumDifficile reste en tete meme avec cap', () => {
    const r = detectClientProfile(baseFemme({
      pathologies: 'diabete T2, retinopathie, SII, hashimoto, sopk, TDAH, clostridium difficile',
    }));
    expect(r.pathologies[0]).toBe('clostridiumDifficile');
  });
});

// ─── BLOCKED FLAG (V96.17 : grossesse/allaitement plus bloques) ──

describe('detectClientProfile — blocked', () => {
  it('Grossesse n\'est PLUS bloquee depuis V96.17 (module dispo)', () => {
    const r = detectClientProfile(baseFemme({ grossesseActuelle: 'Oui' }));
    expect(r.blocked).toBe(false);
  });

  it('Allaitement non bloque non plus', () => {
    const r = detectClientProfile(baseFemme({ allaitement: 'Oui' }));
    expect(r.blocked).toBe(false);
  });

  it('Profil generique homme = pas de primary mais pas blocked', () => {
    const r = detectClientProfile(baseHomme());
    expect(r.blocked).toBe(false);
  });
});

// ─── STRUCTURE DU RETOUR ─────────────────────────────────────────

describe('detectClientProfile — shape de retour', () => {
  it('Retourne { primary, blocked, pathologies, all }', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'diabete' }));
    expect(r).toHaveProperty('primary');
    expect(r).toHaveProperty('blocked');
    expect(r).toHaveProperty('pathologies');
    expect(r).toHaveProperty('all');
    expect(Array.isArray(r.pathologies)).toBe(true);
    expect(Array.isArray(r.all)).toBe(true);
  });

  it('all = primary + pathologies (sans dedup necessaire)', () => {
    const r = detectClientProfile(baseFemme({ pathologies: 'diabete T1, SII' }));
    expect(r.all[0]).toBe(r.primary);
    expect(r.all).toContain('diabete');
    expect(r.all).toContain('digestifChronique');
  });

  it('Form vide ne crash pas', () => {
    const r = detectClientProfile({});
    expect(r).toBeDefined();
    expect(r.blocked).toBe(false);
  });

  it('Form null ne crash pas', () => {
    const r = detectClientProfile(null);
    expect(r).toBeDefined();
  });
});
