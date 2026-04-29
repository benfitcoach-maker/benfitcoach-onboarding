// V94.24 : tests pour le parser canonical de supplements
// Couvre les 2 formats observés (V93.0+ "Moment :" et legacy "Dosage")
// + cas limites (vide, malformé, redondant header)

import { describe, it, expect } from 'vitest';
import { parseSupplementEntriesStructured } from '../nutritionParsers';

describe('parseSupplementEntriesStructured', () => {

  it('Format V93.0+ : Moment / Dose / Pourquoi / Attention', () => {
    const text = `MAGNESIUM GLYCINATE
Moment : Le soir 30 min avant le coucher
Dose : 300 mg (Burgerstein)
Pourquoi : Avec ton stress maximal et tes réveils nocturnes
Attention : À distance du calcium (2h min)`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('MAGNESIUM GLYCINATE');
    expect(entries[0].fields.moment).toMatch(/Le soir/);
    expect(entries[0].fields.dosage).toMatch(/300 mg/);
    expect(entries[0].fields.justification).toMatch(/stress maximal/);
    expect(entries[0].fields.interactions).toMatch(/calcium/);
  });

  it('Plusieurs supplements consécutifs', () => {
    const text = `MAGNESIUM GLYCINATE
Moment : Le soir
Dose : 300 mg

OMEGA-3 EPA/DHA
Moment : Pendant le repas du midi
Dose : 1g EPA/DHA

VITAMINE D3 + K2
Moment : Le matin avec un repas gras
Dose : 2000 UI D3`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries).toHaveLength(3);
    expect(entries[0].name).toBe('MAGNESIUM GLYCINATE');
    expect(entries[1].name).toBe('OMEGA-3 EPA/DHA');
    expect(entries[2].name).toBe('VITAMINE D3 + K2');
  });

  it('Format legacy : Dosage / Sources / Justification / Interactions', () => {
    const text = `VITAMINE D3 + K2
Dosage : 3000 UI D3 + 100 mcg K2 MK-7 (Burgerstein)
Sources : saumon 150g, sardines 100g
Justification : taux limite bas à 50.8 nmol/L
Interactions : associer K2 pour éviter calcification`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('VITAMINE D3 + K2');
    expect(entries[0].fields.dosage).toMatch(/3000 UI/);
    expect(entries[0].fields.sources).toMatch(/saumon/);
    expect(entries[0].fields.justification).toMatch(/50.8 nmol/);
    expect(entries[0].fields.interactions).toMatch(/calcification/);
  });

  it('Header redondant SUPPLEMENTS RECOMMANDES rejeté (pas un supplement)', () => {
    const text = `SUPPLEMENTS RECOMMANDES

MAGNESIUM GLYCINATE
Moment : Le soir
Dose : 300 mg`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('MAGNESIUM GLYCINATE');
  });

  it('Variantes header redondant (RECOMMENDED SUPPLEMENTS, Suppléments)', () => {
    const variants = [
      'SUPPLEMENTS RECOMMANDES',
      'RECOMMENDED SUPPLEMENTS',
      'SUPPLÉMENTS',
      'Suppléments :',
      'SUPPLEMENTS RECOMMANDES :',
    ];

    for (const v of variants) {
      const text = `${v}\n\nMAGNESIUM\nDose : 300mg`;
      const entries = parseSupplementEntriesStructured(text);
      expect(entries.length).toBeLessThanOrEqual(1);
      expect(entries[0]?.name).not.toMatch(/SUPPLEMENT/i);
    }
  });

  it('Texte vide / null', () => {
    expect(parseSupplementEntriesStructured('')).toEqual([]);
    expect(parseSupplementEntriesStructured(null)).toEqual([]);
    expect(parseSupplementEntriesStructured(undefined)).toEqual([]);
  });

  it('Texte sans aucun supplement', () => {
    const text = `Bonjour Melissa, voici ton plan.

C'est un plan classique sans supplement.`;
    expect(parseSupplementEntriesStructured(text)).toEqual([]);
  });

  it('Bullets devant les fields (- Dose : ...)', () => {
    const text = `MAGNESIUM GLYCINATE
- Moment : Le soir
- Dose : 300 mg
• Pourquoi : Stress`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].fields.moment).toMatch(/Le soir/);
    expect(entries[0].fields.dosage).toMatch(/300 mg/);
  });

  it('Markdown stars (**bold**) strippé du nom', () => {
    const text = `**MAGNESIUM GLYCINATE**
Moment : Le soir
Dose : 300 mg`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries[0].name).not.toMatch(/\*/);
  });

  it('Lignes inconnues (sans :) ignorées en silence', () => {
    const text = `MAGNESIUM GLYCINATE
Cette ligne ne contient pas de format reconnu
Dose : 300 mg
Une autre ligne aleatoire`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].fields.dosage).toMatch(/300/);
  });

  it('Field labels variants (FR + EN)', () => {
    const text = `MAGNESIUM
Quand : Le soir
When : Evening
Dose : 300mg
Why : Stress
Pourquoi : Stress chronique`;

    const entries = parseSupplementEntriesStructured(text);
    expect(entries).toHaveLength(1);
    // moment doit être présent (Quand ou When détectés)
    expect(entries[0].fields.moment).toBeDefined();
    // pourquoi/why mappés vers justification
    expect(entries[0].fields.justification).toBeDefined();
  });
});
