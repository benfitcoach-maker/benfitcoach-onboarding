// V97.23.4 — Tests textDiff.js : LCS line diff.

import { describe, it, expect } from 'vitest';
import { diffLines, diffStats } from '../textDiff';

describe('diffLines', () => {
  it('Retourne tout unchanged si textes identiques', () => {
    const a = 'ligne 1\nligne 2\nligne 3';
    const ops = diffLines(a, a);
    expect(ops).toHaveLength(3);
    for (const o of ops) expect(o.type).toBe('unchanged');
  });

  it('Detecte une ligne ajoutee au milieu', () => {
    const a = 'ligne 1\nligne 3';
    const b = 'ligne 1\nligne 2\nligne 3';
    const ops = diffLines(a, b);
    const added = ops.filter((o) => o.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe('ligne 2');
  });

  it('Detecte une ligne retiree', () => {
    const a = 'ligne 1\nligne 2\nligne 3';
    const b = 'ligne 1\nligne 3';
    const ops = diffLines(a, b);
    const removed = ops.filter((o) => o.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].text).toBe('ligne 2');
  });

  it('Detecte modification (removed + added)', () => {
    const a = 'matin: cafe noir';
    const b = 'matin: cafe au lait';
    const ops = diffLines(a, b);
    // Soit 1 removed + 1 added, soit 1 unchanged si LCS choisit differently
    expect(ops.length).toBeGreaterThanOrEqual(1);
    const hasChange = ops.some((o) => o.type === 'added' || o.type === 'removed');
    expect(hasChange).toBe(true);
  });

  it('Texte vide → tout en added pour le nouveau', () => {
    const ops = diffLines('', 'nouveau\nplan');
    const added = ops.filter((o) => o.type === 'added');
    expect(added).toHaveLength(2);
  });

  it('null safety', () => {
    expect(diffLines(null, null)).toEqual([{ type: 'unchanged', text: '' }]);
    expect(Array.isArray(diffLines('a', null))).toBe(true);
  });
});

describe('diffStats', () => {
  it('Aggrege correctement', () => {
    const ops = [
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'added', text: 'c' },
      { type: 'removed', text: 'd' },
      { type: 'added', text: 'e' },
    ];
    const s = diffStats(ops);
    expect(s).toEqual({ added: 2, removed: 1, unchanged: 2, total: 5 });
  });

  it('null safety', () => {
    expect(diffStats(null)).toEqual({ added: 0, removed: 0, unchanged: 0, total: 0 });
  });
});
