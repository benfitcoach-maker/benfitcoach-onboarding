// V94.24 : tests pour le safeParseJson de l'IA Fiche Medecin.
// Critique : si Claude renvoie du JSON malformé, on doit savoir le récupérer
// (markdown fences, texte avant/après, etc.) sinon Anissa voit l'erreur.

import { describe, it, expect } from 'vitest';
import { safeParseJson } from '../aiMedicalSummary';

describe('safeParseJson - parser réponse IA', () => {

  it('JSON pur valide', () => {
    const json = '{"antecedents":"TDAH","approche":"stable"}';
    const result = safeParseJson(json);
    expect(result.antecedents).toBe('TDAH');
    expect(result.approche).toBe('stable');
  });

  it('JSON avec markdown fences ```json', () => {
    const text = '```json\n{"antecedents":"TDAH"}\n```';
    const result = safeParseJson(text);
    expect(result.antecedents).toBe('TDAH');
  });

  it('JSON avec markdown fences sans langage', () => {
    const text = '```\n{"foo":"bar"}\n```';
    const result = safeParseJson(text);
    expect(result.foo).toBe('bar');
  });

  it('JSON avec texte avant', () => {
    const text = 'Voici la fiche : {"antecedents":"TDAH"}';
    const result = safeParseJson(text);
    expect(result.antecedents).toBe('TDAH');
  });

  it('JSON avec texte avant ET après', () => {
    const text = 'Bonjour, voici : {"foo":"bar"} fin de message.';
    const result = safeParseJson(text);
    expect(result.foo).toBe('bar');
  });

  it('JSON multiline complexe', () => {
    const text = `{
      "antecedents": "TDAH, fatigue",
      "supplements": [
        {"name": "MAGNESIUM", "dose": "300mg"},
        {"name": "VITAMINE D3", "dose": "2000 UI"}
      ]
    }`;
    const result = safeParseJson(text);
    expect(result.antecedents).toBe('TDAH, fatigue');
    expect(result.supplements).toHaveLength(2);
    expect(result.supplements[0].name).toBe('MAGNESIUM');
  });

  it('JSON avec accents préservés', () => {
    const text = '{"approche":"Soutien rénal et hépatique"}';
    const result = safeParseJson(text);
    expect(result.approche).toBe('Soutien rénal et hépatique');
  });

  it('Réponse vide → throw', () => {
    expect(() => safeParseJson('')).toThrow();
    expect(() => safeParseJson(null)).toThrow();
    expect(() => safeParseJson(undefined)).toThrow();
  });

  it('JSON invalide (syntax error) → throw avec message clair', () => {
    expect(() => safeParseJson('{not valid json')).toThrow(/JSON.*invalide/i);
  });

  it('Texte sans aucun JSON → throw', () => {
    expect(() => safeParseJson('Bonjour, comment vas-tu ?')).toThrow();
  });

  it('JSON avec espaces / newlines autour', () => {
    const text = '   \n\n   {"foo":"bar"}   \n  ';
    const result = safeParseJson(text);
    expect(result.foo).toBe('bar');
  });
});
