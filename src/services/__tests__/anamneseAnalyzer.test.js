// V94.24 : tests unitaires pour le service critique anamneseAnalyzer.
// Couvre les 10+ profils types attendus + cas limites.
// Run : npm test

import { describe, it, expect } from 'vitest';
import { analyzeAnamnese } from '../anamneseAnalyzer';

// ─── Helpers ─────────────────────────────────────────────────────

const baseProfile = (overrides = {}) => ({
  prenom: 'Test',
  age: 30,
  genre: 'F',
  poids: 60,
  taille: 165,
  ...overrides,
});

const findTest = (analysis, namePattern) =>
  analysis.suggestedTests.find(t => new RegExp(namePattern, 'i').test(t.test));

const hasPathologie = (analysis, key) => analysis.pathologies[key]?.active;
const hasTraitement = (analysis, key) => analysis.traitements[key]?.active;

// ─── PROFILS TYPES ───────────────────────────────────────────────

describe('anamneseAnalyzer - profils types', () => {

  it('Profil Hawazen : femme 32 ans, TDAH, projet grossesse, antécédent diabète T1', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 32, poids: 60.4, taille: 161,
      pathologies: 'TDAH, injections de fer annuelles',
      antecedentsFamiliaux: 'diabète type 1, AVC père',
      projetGrossesse: 'Oui je souhaite envisager',
      niveauStressActuel: 8,
      heuresSommeil: 6,
      energieJournee: 2,
    }));

    expect(a.demographics.cohort).toBe('femme_projet_grossesse');
    expect(hasPathologie(a, 'tdah')).toBe(true);
    expect(a.familyHistory.diabete).toBe(true);
    expect(a.familyHistory.cv_precoce).toBe(true);
    expect(a.symptoms).toContain('fatigue');
    expect(a.symptoms).toContain('stress');

    // Tests attendus pour ce profil
    expect(findTest(a, 'Ferritine')).toBeDefined();
    expect(findTest(a, 'B12')).toBeDefined();
    expect(findTest(a, 'Vit D')).toBeDefined();
    expect(findTest(a, 'TSH')).toBeDefined();
    expect(findTest(a, 'HbA1c')).toBeDefined();
    expect(findTest(a, 'Cortisol')).toBeDefined();
    expect(a.suggestedTests.length).toBeGreaterThan(5);
  });

  it('Profil Melissa : diabète T1 sous pompe + complications + stress', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 42, genre: 'F', poids: 75, taille: 165,
      pathologies: 'diabète de type 1 sous pompe à insuline menimed780g, rétinopathie proliférante, gonarthrose',
      traitements: 'insuline pompe',
      niveauStressActuel: 10,
      heuresSommeil: 6,
    }));

    expect(hasPathologie(a, 'diabete_t1')).toBe(true);
    expect(a.pathologies.diabete_t1.hasPump).toBe(true);
    expect(a.pathologies.diabete_t1.complications.retinopathie).toBe(true);
    expect(hasPathologie(a, 'gonarthrose')).toBe(true);
    expect(hasTraitement(a, 'insuline')).toBe(true);

    // Red flags critiques
    expect(a.redFlags.some(f => /microalbuminurie/i.test(f.label))).toBe(true);
    expect(a.redFlags.some(f => /fond.*oeil/i.test(f.label))).toBe(true);

    // Tests obligatoires diabète
    expect(findTest(a, 'HbA1c')).toBeDefined();
    expect(findTest(a, 'Microalbuminurie')).toBeDefined();
    expect(findTest(a, 'Fond')).toBeDefined();
    expect(findTest(a, 'Bilan lipidique')).toBeDefined();
  });

  it('Profil patient sous AVK : interactions strictes', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 65, genre: 'H',
      pathologies: 'fibrillation auriculaire',
      traitements: 'sintrom 4mg/jour',
    }));

    expect(hasTraitement(a, 'avk')).toBe(true);
    expect(a.traitements.avk.tests).toContain('INR');
    expect(a.traitements.avk.interactions.some(i => /Vitamine K2/i.test(i))).toBe(true);
    expect(a.traitements.avk.interactions.some(i => /Omega-3/i.test(i))).toBe(true);

    // Red flag AVK
    expect(a.redFlags.some(f => /AVK.*INR/i.test(f.label))).toBe(true);

    // INR dans les tests suggérés
    expect(findTest(a, 'INR')).toBeDefined();
  });

  it('Profil patient sous Levothyrox : tests thyroïdiens', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 45, genre: 'F',
      pathologies: 'hypothyroïdie Hashimoto',
      traitements: 'levothyrox 75mcg/jour',
    }));

    expect(hasPathologie(a, 'hypothyroidie')).toBe(true);
    expect(a.pathologies.hypothyroidie.auto_immune).toBe(true);
    expect(hasTraitement(a, 'levothyrox')).toBe(true);

    expect(findTest(a, 'TSH')).toBeDefined();
    expect(findTest(a, 'T4 libre')).toBeDefined();
    expect(findTest(a, 'Anti-TPO')).toBeDefined();
  });

  it('Profil femme enceinte : examens prioritaires grossesse', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 30, genre: 'F',
      pathologies: 'enceinte 3 mois',
    }));

    expect(a.demographics.cohort).toBe('femme_enceinte');
    expect(a.demographics.grossesseEnCours).toBe(true);

    // Red flag grossesse
    expect(a.redFlags.some(f => /grossesse.*supplement/i.test(f.label))).toBe(true);

    // Tests essentiels grossesse
    const ferritine = findTest(a, 'Ferritine');
    expect(ferritine).toBeDefined();
    expect(ferritine.priority).toBe('essentiel');

    expect(findTest(a, 'B12')).toBeDefined();
    expect(findTest(a, 'Vit D')).toBeDefined();
    expect(findTest(a, 'TSH')).toBeDefined();
    expect(findTest(a, 'Glycemie')).toBeDefined(); // dépistage diabète gestationnel
  });

  it('Profil femme ménopausée : DEXA + lipidique', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 55, genre: 'F',
      pathologies: 'ménopause depuis 3 ans, ostéoporose surveillée',
      antecedentsFamiliaux: 'fracture col fémur grand-mère',
    }));

    expect(a.demographics.cohort).toBe('femme_menopausee');
    expect(a.familyHistory.osteoporose).toBe(true);

    expect(findTest(a, 'Vit D')).toBeDefined();
    expect(findTest(a, 'Bilan lipidique')).toBeDefined();
    expect(findTest(a, 'Calcium')).toBeDefined();
  });

  it('Profil homme 55 ans : dépistage CV + diabète', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 55, genre: 'H', poids: 90, taille: 175,
      pathologies: 'aucune',
    }));

    expect(a.demographics.cohort).toBe('homme_50_plus');
    expect(a.demographics.imcCategory).toBe('surpoids');

    expect(findTest(a, 'Bilan lipidique')).toBeDefined();
    expect(findTest(a, 'Glyc')).toBeDefined();
    expect(findTest(a, 'PSA')).toBeDefined();
  });

  it('Profil obésité morbide : insulinorésistance + stéatose', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 38, genre: 'F', poids: 110, taille: 165,
      pathologies: 'aucune',
    }));

    expect(a.demographics.imc).toBeGreaterThan(40);
    expect(a.demographics.imcCategory).toBe('obesite_3');
    expect(a.symptoms).toContain('weight_gain');

    const glyc = findTest(a, 'Glyc');
    expect(glyc).toBeDefined();
    expect(glyc.priority).toBe('essentiel');

    expect(findTest(a, 'Insuline')).toBeDefined();
    expect(findTest(a, 'hepatique|ASAT')).toBeDefined();
  });

  it('Profil SOPK : androgènes + insulinoresistance', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 28, genre: 'F',
      pathologies: 'SOPK confirmé, hirsutisme',
    }));

    expect(hasPathologie(a, 'sopk')).toBe(true);

    expect(findTest(a, 'Insuline')).toBeDefined();
    expect(findTest(a, 'Testosterone')).toBeDefined();
    expect(findTest(a, 'LH')).toBeDefined();
  });

  it('Profil dépression + antidepresseur : Vit D + B12 + bilan hépatique', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 35, genre: 'F',
      pathologies: 'dépression chronique',
      traitements: 'sertraline 50mg/jour',
    }));

    expect(hasPathologie(a, 'depression')).toBe(true);
    expect(hasTraitement(a, 'antidepresseurs')).toBe(true);

    expect(findTest(a, 'Vitamine D|Vit D')).toBeDefined();
    expect(findTest(a, 'Homocysteine')).toBeDefined();
    expect(findTest(a, 'B12')).toBeDefined();
  });

  it('Profil minimaliste (peu d info) : tests par défaut', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 25,
    }));

    // Pas de red flags
    expect(a.redFlags).toEqual([]);
    // Tous les pathos inactifs
    expect(Object.values(a.pathologies).every(p => !p.active)).toBe(true);
  });

  it('Profil null/vide : ne crash pas', () => {
    expect(() => analyzeAnamnese(null)).not.toThrow();
    expect(() => analyzeAnamnese({})).not.toThrow();
    expect(() => analyzeAnamnese(undefined)).not.toThrow();

    const a = analyzeAnamnese({});
    expect(a.suggestedTests).toBeDefined();
    expect(Array.isArray(a.suggestedTests)).toBe(true);
  });
});

// ─── PRIORITÉS DES TESTS ─────────────────────────────────────────

describe('anamneseAnalyzer - priorisation', () => {

  it('Tests sont triés par priorité (essentiel > recommande > optionnel)', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 32, genre: 'F',
      pathologies: 'diabète type 1',
      antecedentsFamiliaux: 'cancer sein',
    }));

    const priorities = a.suggestedTests.map(t => t.priority);
    const order = { essentiel: 0, recommande: 1, optionnel: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i-1]]);
    }
  });

  it('Pas de doublons dans les tests suggérés', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 32, genre: 'F',
      pathologies: 'diabète type 1, hypothyroïdie',
      antecedentsFamiliaux: 'diabète, AVC père',
      niveauStressActuel: 10,
    }));

    const names = a.suggestedTests.map(t => t.test.toLowerCase());
    const unique = [...new Set(names)];
    expect(names.length).toBe(unique.length);
  });

  it('Source de chaque test est tracée', () => {
    const a = analyzeAnamnese(baseProfile({
      age: 32, genre: 'F',
      pathologies: 'diabète type 1',
    }));

    for (const t of a.suggestedTests) {
      expect(t.source).toBeDefined();
      expect(['pathologie', 'traitement', 'famille', 'demographie', 'lifestyle', 'symptome']).toContain(t.source);
    }
  });
});

// ─── DEMOGRAPHIE ─────────────────────────────────────────────────

describe('anamneseAnalyzer - démographie & cohortes', () => {

  it('IMC calculé correctement', () => {
    const a = analyzeAnamnese({ poids: 70, taille: 170 });
    expect(a.demographics.imc).toBeCloseTo(24.2, 1);
    expect(a.demographics.imcCategory).toBe('normal');
  });

  it('IMC catégories : maigreur/normal/surpoids/obesite_1/2/3', () => {
    expect(analyzeAnamnese({ poids: 45, taille: 170 }).demographics.imcCategory).toBe('maigreur');     // IMC 15.6
    expect(analyzeAnamnese({ poids: 70, taille: 170 }).demographics.imcCategory).toBe('normal');       // IMC 24.2
    expect(analyzeAnamnese({ poids: 80, taille: 170 }).demographics.imcCategory).toBe('surpoids');     // IMC 27.7
    expect(analyzeAnamnese({ poids: 95, taille: 170 }).demographics.imcCategory).toBe('obesite_1');    // IMC 32.9
    expect(analyzeAnamnese({ poids: 110, taille: 170 }).demographics.imcCategory).toBe('obesite_2');   // IMC 38.1
    expect(analyzeAnamnese({ poids: 130, taille: 170 }).demographics.imcCategory).toBe('obesite_3');   // IMC 45.0
  });

  it('Cohorte femme jeune vs active vs perimenopause', () => {
    expect(analyzeAnamnese({ age: 25, genre: 'F' }).demographics.cohort).toBe('femme_jeune');
    expect(analyzeAnamnese({ age: 35, genre: 'F' }).demographics.cohort).toBe('femme_active');
    expect(analyzeAnamnese({ age: 47, genre: 'F' }).demographics.cohort).toBe('femme_perimenopause');
  });
});

// ─── LIFESTYLE ───────────────────────────────────────────────────

describe('anamneseAnalyzer - lifestyle', () => {

  it('Stress maximal détecté (niveau 9-10)', () => {
    const a = analyzeAnamnese({ niveauStressActuel: 10 });
    expect(a.lifestyle.stressMaximal).toBe(true);
    expect(a.lifestyle.stressEleve).toBe(true);
  });

  it('Sommeil très court détecté (< 6h)', () => {
    const a = analyzeAnamnese({ heuresSommeil: 5 });
    expect(a.lifestyle.sommeilTresCourt).toBe(true);
  });

  it('Alcool fréquent détecté', () => {
    const a = analyzeAnamnese({ alcool: 'tous les jours' });
    expect(a.lifestyle.alcoolFrequent).toBe(true);
  });

  it('Tour de taille élevé femme (>= 88cm)', () => {
    const a = analyzeAnamnese({ genre: 'F', tourTaille: 90 });
    expect(a.lifestyle.tourTailleHaut).toBe(true);
  });
});
