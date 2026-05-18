// V97.26 (audit fix tests gap) — Tests computeDiff (logique pure).
// Le whitelist TRACKED_FIELDS protege contre l'audit log qui logge
// des changements non-souhaites (ex: created_at qui change a chaque save).

import { describe, it, expect } from 'vitest';
import { computeDiff } from '../clinicalGuardrailsService';

describe('computeDiff', () => {
  it('Retourne objet vide si avant et apres identiques', () => {
    const obj = {
      display_name: 'Grossesse',
      forbidden_phrases: ['x'],
      required_phrases: [],
      micronutrients: [],
      evictions: [],
      precaution_vocab: {},
      enabled: true,
    };
    expect(computeDiff(obj, obj)).toEqual({});
    expect(computeDiff({ ...obj }, { ...obj })).toEqual({});
  });

  it('Detecte changement display_name', () => {
    const before = { display_name: 'A', forbidden_phrases: [] };
    const after = { display_name: 'B', forbidden_phrases: [] };
    const diff = computeDiff(before, after);
    expect(diff.display_name).toEqual({ before: 'A', after: 'B' });
    expect(diff.forbidden_phrases).toBeUndefined();
  });

  it('Detecte ajout dans array', () => {
    const before = { forbidden_phrases: ['x'] };
    const after = { forbidden_phrases: ['x', 'y'] };
    const diff = computeDiff(before, after);
    expect(diff.forbidden_phrases).toEqual({ before: ['x'], after: ['x', 'y'] });
  });

  it('Detecte changement order dans array (JSON.stringify strict)', () => {
    const before = { forbidden_phrases: ['x', 'y'] };
    const after = { forbidden_phrases: ['y', 'x'] };
    const diff = computeDiff(before, after);
    expect(diff.forbidden_phrases).toBeDefined();
  });

  it('Ignore les fields hors TRACKED_FIELDS (created_at, id, etc.)', () => {
    const before = { display_name: 'A', id: 'uuid1', created_at: '2026-01-01' };
    const after = { display_name: 'A', id: 'uuid1', created_at: '2026-05-18' };
    expect(computeDiff(before, after)).toEqual({});
  });

  it('Detecte changement jsonb precaution_vocab', () => {
    const before = { precaution_vocab: { 'a': 'b' } };
    const after = { precaution_vocab: { 'a': 'b', 'c': 'd' } };
    const diff = computeDiff(before, after);
    expect(diff.precaution_vocab).toBeDefined();
    expect(diff.precaution_vocab.after).toEqual({ a: 'b', c: 'd' });
  });

  it('Null safety', () => {
    expect(computeDiff(null, { display_name: 'A' })).toEqual({});
    expect(computeDiff({ display_name: 'A' }, null)).toEqual({});
    expect(computeDiff(null, null)).toEqual({});
  });

  it('Detecte toggle enabled', () => {
    const before = { enabled: true };
    const after = { enabled: false };
    const diff = computeDiff(before, after);
    expect(diff.enabled).toEqual({ before: true, after: false });
  });
});
