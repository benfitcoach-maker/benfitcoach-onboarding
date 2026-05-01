// V94.24 : tests pour le parser canonical de supplements
// Couvre les 2 formats observés (V93.0+ "Moment :" et legacy "Dosage")
// + cas limites (vide, malformé, redondant header)

import { describe, it, expect } from 'vitest';
import {
  parseSupplementEntriesStructured,
  parseSlotAlternatives,
  normalizeSlotLabelToSlot,
} from '../nutritionParsers';

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

// V95 : tests pour le parser des "## 4. ALTERNATIVES PAR REPAS"
describe('parseSlotAlternatives', () => {

  it('Cas nominal : 4 slots, 3 alternatives chacun', () => {
    const text = `### Petit-dejeuner
- Porridge avoine & fruits rouges — 40g flocons, lait amande, 100g myrtilles
- Smoothie banane & beurre amande — 1 banane, 200ml lait vegetal, 1 c.s. beurre amande
- Yaourt grec & granola — 150g yaourt, 30g granola maison, 1 c.c. miel

### Dejeuner
- Saumon vapeur & quinoa — 120g saumon, 80g quinoa, brocolis vapeur
- Bowl tofu & sarrasin — 130g tofu ferme, 80g sarrasin, ratatouille
- Cabillaud & legumes rotis — 150g cabillaud, courgettes, poivrons rotis

### Collation
- Yaourt grec & noix — 150g yaourt, 20g noix
- Carre chocolat noir & noisettes — 70% cacao, 15g noisettes

### Diner
- Veloute potimarron & oeuf — graines de courge, curcuma
- Omelette aux herbes & salade — 3 oeufs, ciboulette, roquette
- Dahl de lentilles & riz basmati — lait de coco, epices douces`;

    const groups = parseSlotAlternatives(text);
    expect(groups).toHaveLength(4);
    expect(groups[0].slotLabel).toBe('Petit-dejeuner');
    expect(groups[0].items).toHaveLength(3);
    expect(groups[0].items[0].title).toBe('Porridge avoine & fruits rouges');
    expect(groups[0].items[0].hint).toMatch(/40g flocons/);
    expect(groups[1].slotLabel).toBe('Dejeuner');
    expect(groups[2].items).toHaveLength(2); // collation a 2 alts
  });

  it('Em-dash variants : —, –, - acceptes comme separateurs', () => {
    const text = `### Petit-dejeuner
- Recette A — hint avec em-dash
- Recette B – hint avec en-dash
- Recette C - hint avec hyphen-minus`;

    const groups = parseSlotAlternatives(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(3);
    expect(groups[0].items[0].title).toBe('Recette A');
    expect(groups[0].items[1].title).toBe('Recette B');
    expect(groups[0].items[2].title).toBe('Recette C');
    expect(groups[0].items[0].hint).toBe('hint avec em-dash');
  });

  it('Bullets sans hint : title seulement', () => {
    const text = `### Dejeuner
- Salade complete
- Bowl proteine
- Wrap legumes`;

    const groups = parseSlotAlternatives(text);
    expect(groups[0].items).toHaveLength(3);
    expect(groups[0].items[0].title).toBe('Salade complete');
    expect(groups[0].items[0].hint).toBeUndefined();
  });

  it('Section vide : input null/undefined → tableau vide', () => {
    expect(parseSlotAlternatives('')).toEqual([]);
    expect(parseSlotAlternatives(null)).toEqual([]);
    expect(parseSlotAlternatives(undefined)).toEqual([]);
  });

  it('Header sans bullets : groupe filtre (drop)', () => {
    const text = `### Petit-dejeuner

### Dejeuner
- Une seule recette — avec hint`;

    const groups = parseSlotAlternatives(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].slotLabel).toBe('Dejeuner');
  });

  it('Bullets en dehors d\'un header : ignores', () => {
    const text = `- Recette flottante avant header

### Petit-dejeuner
- Recette legitime — hint`;

    const groups = parseSlotAlternatives(text);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].title).toBe('Recette legitime');
  });

  it('Em-dash dans le titre (pas de split sur premier match) : split sur premier separateur entoure d\'espaces', () => {
    const text = `### Dejeuner
- Bowl saumon-avocat — riz basmati, sesame`;

    // "saumon-avocat" sans espaces autour du - → ne doit pas splitter
    // Le split se fait sur " — " (em-dash entoure d'espaces)
    const groups = parseSlotAlternatives(text);
    expect(groups[0].items[0].title).toBe('Bowl saumon-avocat');
    expect(groups[0].items[0].hint).toBe('riz basmati, sesame');
  });

  it('V95.3 : sous-header sans ### (texte nu) → detecte si slot connu', () => {
    // Cas reel observe sur le plan Melissa : l'IA omet parfois les ###
    const text = `Petit-déjeuner
- Porridge sarrasin & cannelle — 40g flocons, lait amande
- Smoothie épinards & avocat — 200ml lait vegetal

Déjeuner
- Saumon vapeur & legumineuses — 100g saumon, lentilles vertes

Collation
- Compote & oleagineux — 25g noix

Dîner
- Cabillaud & legumes vapeur — julienne legumes`;

    const groups = parseSlotAlternatives(text);
    expect(groups).toHaveLength(4);
    expect(groups[0].slotLabel).toBe('Petit-déjeuner');
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].slotLabel).toBe('Déjeuner');
    expect(groups[2].slotLabel).toBe('Collation');
    expect(groups[3].slotLabel).toBe('Dîner');
  });

  it('V95.3 : sous-header en bold **Petit-dejeuner** → detecte', () => {
    const text = `**Petit-dejeuner**
- Porridge — 40g flocons
- Smoothie — banane

**Dejeuner**
- Saumon — 120g`;

    const groups = parseSlotAlternatives(text);
    expect(groups).toHaveLength(2);
    expect(groups[0].slotLabel).toBe('Petit-dejeuner');
    expect(groups[1].slotLabel).toBe('Dejeuner');
  });

  it('V95.3 : ligne courte mais slot inconnu → ignoree (pas de header)', () => {
    const text = `Aperitif
- Olives — 30g`;

    // "Aperitif" n'est pas un slot connu → pas de groupe ouvert
    const groups = parseSlotAlternatives(text);
    expect(groups).toEqual([]);
  });

  it('V95.3 : "Petit-dejeuner : ..." (avec :) PAS interprete comme header', () => {
    // Cas SEMAINE 1 : "Petit-déjeuner : 1 oeuf..." ne doit pas etre
    // confondu avec un header alternatives (presence du ":" l'exclut)
    const text = `Petit-dejeuner : 1 oeuf + pain
Dejeuner : 100g cabillaud`;

    const groups = parseSlotAlternatives(text);
    expect(groups).toEqual([]);
  });
});

describe('normalizeSlotLabelToSlot', () => {

  it('FR : libellés canoniques', () => {
    expect(normalizeSlotLabelToSlot('Petit-dejeuner')).toBe('breakfast');
    expect(normalizeSlotLabelToSlot('Dejeuner')).toBe('lunch');
    expect(normalizeSlotLabelToSlot('Diner')).toBe('dinner');
    expect(normalizeSlotLabelToSlot('Collation')).toBe('afternoon_snack');
  });

  it('FR : avec accents', () => {
    expect(normalizeSlotLabelToSlot('Petit-déjeuner')).toBe('breakfast');
    expect(normalizeSlotLabelToSlot('Déjeuner')).toBe('lunch');
    expect(normalizeSlotLabelToSlot('Dîner')).toBe('dinner');
  });

  it('FR : casse variable', () => {
    expect(normalizeSlotLabelToSlot('PETIT-DEJEUNER')).toBe('breakfast');
    expect(normalizeSlotLabelToSlot('petit dejeuner')).toBe('breakfast');
    expect(normalizeSlotLabelToSlot('DÎNER')).toBe('dinner');
  });

  it('EN : breakfast/lunch/dinner', () => {
    expect(normalizeSlotLabelToSlot('Breakfast')).toBe('breakfast');
    expect(normalizeSlotLabelToSlot('Lunch')).toBe('lunch');
    expect(normalizeSlotLabelToSlot('Dinner')).toBe('dinner');
    expect(normalizeSlotLabelToSlot('Snack')).toBe('afternoon_snack');
  });

  it('Collation matin/soir : raffinement', () => {
    expect(normalizeSlotLabelToSlot('Collation matinale')).toBe('morning_snack');
    expect(normalizeSlotLabelToSlot('Collation du soir')).toBe('evening_snack');
  });

  it('Libellé inconnu : null', () => {
    expect(normalizeSlotLabelToSlot('Aperitif')).toBeNull();
    expect(normalizeSlotLabelToSlot('')).toBeNull();
    expect(normalizeSlotLabelToSlot(null)).toBeNull();
  });
});
