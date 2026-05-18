// V97.26 (audit fix tests gap) — Tests rewriteSlopSection cleanup +
// replaceLineInPlan.
// Le service appelle Claude Haiku donc on mock callClaude.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock callClaude AVANT l'import du module a tester
vi.mock('../anthropic', () => ({
  callClaude: vi.fn(),
}));

import { rewriteSlopSection, replaceLineInPlan } from '../rewriteSlopSection';
import { callClaude } from '../anthropic';

describe('replaceLineInPlan', () => {
  it('Remplace une ligne par index', () => {
    const plan = 'ligne 0\nligne 1\nligne 2';
    const out = replaceLineInPlan(plan, 1, 'NOUVEAU');
    expect(out).toBe('ligne 0\nNOUVEAU\nligne 2');
  });

  it('Garde le plan inchange si lineIndex hors bornes', () => {
    const plan = 'ligne 0\nligne 1';
    expect(replaceLineInPlan(plan, 99, 'X')).toBe(plan);
    expect(replaceLineInPlan(plan, -1, 'X')).toBe(plan);
  });

  it('Retourne plan inchange si plan invalide', () => {
    expect(replaceLineInPlan(null, 0, 'X')).toBe(null);
    expect(replaceLineInPlan('', 0, 'X')).toBe('');
  });
});

describe('rewriteSlopSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Retourne error si passage vide', async () => {
    const res = await rewriteSlopSection({ passage: '', flags: [{ category: 'ai_vocab', reason: 'r' }] });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('passage');
  });

  it('Retourne error si flags vide', async () => {
    const res = await rewriteSlopSection({ passage: 'texte', flags: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('flag');
  });

  it('Strip guillemets ajoutes par Claude', async () => {
    callClaude.mockResolvedValue('"voici la reformulation"');
    const res = await rewriteSlopSection({
      passage: 'protocole de base',
      flags: [{ category: 'ai_vocab', reason: 'jargon' }],
    });
    expect(res.ok).toBe(true);
    expect(res.rewritten).toBe('voici la reformulation');
  });

  it('Strip triple guillemets eventuels', async () => {
    callClaude.mockResolvedValue('"""\ntexte reformule\n"""');
    const res = await rewriteSlopSection({
      passage: 'origin',
      flags: [{ category: 'cliche', reason: 'metaphore' }],
    });
    expect(res.ok).toBe(true);
    expect(res.rewritten).toBe('texte reformule');
  });

  it('Retourne error si Claude renvoie vide', async () => {
    callClaude.mockResolvedValue('');
    const res = await rewriteSlopSection({
      passage: 'origin',
      flags: [{ category: 'ai_vocab', reason: 'r' }],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('vide');
  });

  it('Catch exception callClaude', async () => {
    callClaude.mockRejectedValue(new Error('reseau down'));
    const res = await rewriteSlopSection({
      passage: 'origin',
      flags: [{ category: 'ai_vocab', reason: 'r' }],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('reseau down');
  });

  it('Construit le user prompt avec les raisons des flags (deduplique)', async () => {
    callClaude.mockResolvedValue('reformule');
    await rewriteSlopSection({
      passage: 'mon texte',
      flags: [
        { category: 'ai_vocab', reason: 'jargon AI' },
        { category: 'ai_vocab', reason: 'jargon AI' }, // duplicate
        { category: 'cliche', reason: 'metaphore figée' },
      ],
    });
    expect(callClaude).toHaveBeenCalledTimes(1);
    const callArg = callClaude.mock.calls[0][0];
    expect(callArg.user).toContain('jargon AI / metaphore figée');
    expect(callArg.user).toContain('mon texte');
  });
});
