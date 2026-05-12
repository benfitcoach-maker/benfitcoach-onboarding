// V97.4 V3.H Quick win — Tests détection glycémie instable structurée.
// Date : 2026-05-12
//
// Le detector exploite maintenant les champs structurés fringalesSucre +
// variationsGlycemie + reactionGlucides pour déclencher le tag 'diabete'
// (qui couvre prédiabète / insulinorésistance / glycémie instable).
//
// Conservateur : pattern COMBINATOIRE obligatoire (fringales fortes +
// variations marquées OU réaction glucides instable). Aucun signal isolé
// ne suffit à déclencher.

import { describe, it, expect } from 'vitest';
import { detectClientProfile } from '../services/prompts/nutrition/profiles/_detector.fr';

describe('V3.H quick win — détection glycémie instable structurée', () => {

  it('fringales quotidiennes + variations en permanence → tag diabete', () => {
    const profile = detectClientProfile({
      fringalesSucre: 'Quotidiennement',
      variationsGlycemie: 'Oui en permanence',
    });
    expect(profile.all).toContain('diabete');
  });

  it('fringales plusieurs fois/jour + somnolence post-repas → tag diabete', () => {
    const profile = detectClientProfile({
      fringalesSucre: 'Plusieurs fois par jour',
      reactionGlucides: ['Somnolence'],
    });
    expect(profile.all).toContain('diabete');
  });

  it('fringales quotidiennes seules → PAS de tag (signal isolé)', () => {
    const profile = detectClientProfile({
      fringalesSucre: 'Quotidiennement',
    });
    expect(profile.all).not.toContain('diabete');
  });

  it('variations en permanence sans fringales → PAS de tag (signal isolé)', () => {
    const profile = detectClientProfile({
      variationsGlycemie: 'Oui en permanence',
    });
    expect(profile.all).not.toContain('diabete');
  });

  it('somnolence seule sans fringales → PAS de tag', () => {
    const profile = detectClientProfile({
      reactionGlucides: ['Somnolence', 'Faim rapide'],
    });
    expect(profile.all).not.toContain('diabete');
  });

  it('fringales occasionnelles + variations → PAS de tag (fringales faibles)', () => {
    const profile = detectClientProfile({
      fringalesSucre: 'Occasionnellement',
      variationsGlycemie: 'Oui en permanence',
    });
    expect(profile.all).not.toContain('diabete');
  });

  it('fringales jamais + tous signaux glucides → PAS de tag', () => {
    const profile = detectClientProfile({
      fringalesSucre: 'Jamais',
      variationsGlycemie: 'Oui en permanence',
      reactionGlucides: ['Somnolence', 'Ballonnements', 'Faim rapide'],
    });
    expect(profile.all).not.toContain('diabete');
  });

  it('Énergie stable contredit instabilité → fringales quotidiennes + stable seul → PAS de tag', () => {
    const profile = detectClientProfile({
      fringalesSucre: 'Quotidiennement',
      reactionGlucides: ['Energie stable'],
    });
    expect(profile.all).not.toContain('diabete');
  });

  it('Pathologie diabète explicite reste détectée (legacy)', () => {
    const profile = detectClientProfile({
      pathologies: 'Prédiabète diagnostiqué 2024',
    });
    expect(profile.all).toContain('diabete');
  });

  it('Pattern complet glycémie instable + autres profils → tags multiples', () => {
    const profile = detectClientProfile({
      genre: 'Femme',
      grossesseActuelle: 'Oui',
      fringalesSucre: 'Plusieurs fois par jour',
      variationsGlycemie: 'Oui apres les repas',
    });
    expect(profile.all).toContain('diabete');
    expect(profile.all).toContain('grossesse');
  });
});
