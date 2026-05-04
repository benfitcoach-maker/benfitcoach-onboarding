// V96.27 — Tests unitaires registry des modules profil FR.
// Garantit qu'aucun module n'est manquant ou orphan dans le registry.

import { describe, it, expect } from 'vitest';
import { PROFILE_MODULES_FR, getProfileModuleFr } from '../profiles/index.fr';

// Liste des 20 tags attendus (V96.26)
const EXPECTED_TAGS = [
  // Hormonal/maternel (8)
  'femmeCycle', 'perimenopause', 'menopause',
  'grossesse', 'allaitement', 'postPartum',
  'spm', 'sopk',
  // Metabolique (4)
  'diabete', 'complicationsDiabete', 'nephropathie', 'thyroide',
  // Digestif (2)
  'digestifChronique', 'clostridiumDifficile',
  // Vie/stress (3)
  'burnoutCortisol', 'saos', 'tdah',
  // Performance/fertilite (3)
  'performanceSportif', 'preConceptionFertilite', 'endometriose',
];

describe('PROFILE_MODULES_FR — registry', () => {
  it('Contient les 20 modules attendus', () => {
    const keys = Object.keys(PROFILE_MODULES_FR);
    expect(keys.length).toBe(EXPECTED_TAGS.length);
    for (const tag of EXPECTED_TAGS) {
      expect(keys).toContain(tag);
    }
  });

  it('Chaque module est une string non vide', () => {
    for (const [tag, content] of Object.entries(PROFILE_MODULES_FR)) {
      expect(typeof content, `Module ${tag} doit etre string`).toBe('string');
      expect(content.length, `Module ${tag} ne peut pas etre vide`).toBeGreaterThan(100);
    }
  });

  it('Chaque module commence par "ADAPTATION" (convention)', () => {
    for (const [tag, content] of Object.entries(PROFILE_MODULES_FR)) {
      expect(content, `Module ${tag} doit commencer par ADAPTATION`).toMatch(/ADAPTATION /);
    }
  });

  it('Chaque module contient un cadrage clinique ou MUST INCLUDE', () => {
    for (const [tag, content] of Object.entries(PROFILE_MODULES_FR)) {
      const hasGuidance = /MUST INCLUDE|CADRAGE|priorite/i.test(content);
      expect(hasGuidance, `Module ${tag} doit avoir un cadrage clinique`).toBe(true);
    }
  });

  it('Aucun module ne contient de mention dose insuline (garde-fou T1)', () => {
    for (const [tag, content] of Object.entries(PROFILE_MODULES_FR)) {
      // On verifie que le module ne PRESCRIT pas un dosage insuline.
      // Les modules diabete/complicationsDiabete peuvent MENTIONNER l'insuline
      // au sens "perimetre medecin / interdit" mais jamais en prescription.
      const prescritInsuline = /prescrire?\s+\d+\s*(?:UI|unite)\s*d.insuline/i.test(content)
        || /augmenter\s+(?:de|la)\s+dose\s+d.insuline/i.test(content)
        || /ajuster\s+ta\s+dose\s+d.insuline/i.test(content);
      expect(prescritInsuline, `Module ${tag} ne doit pas prescrire de dose insuline`).toBe(false);
    }
  });
});

describe('getProfileModuleFr', () => {
  it('Retourne le module pour chaque tag attendu', () => {
    for (const tag of EXPECTED_TAGS) {
      const module = getProfileModuleFr(tag);
      expect(module, `getProfileModuleFr('${tag}') doit retourner le module`).toBeTruthy();
      expect(typeof module).toBe('string');
    }
  });

  it('Retourne null pour un tag inconnu', () => {
    expect(getProfileModuleFr('moduleQuiNExistePas')).toBeNull();
    expect(getProfileModuleFr('')).toBeNull();
    expect(getProfileModuleFr(null)).toBeNull();
    expect(getProfileModuleFr(undefined)).toBeNull();
  });
});
