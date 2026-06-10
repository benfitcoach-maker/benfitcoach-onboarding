// P0.3 (remède sécurité clinique, 2026-06-10) — détection de troncature IA.
//
// Une réponse coupée à `stop_reason: 'max_tokens'` a perdu sa fin — précisément
// là où tombent les évictions allergènes et les précautions médicamenteuses.
// callClaude doit lever une erreur honnête plutôt que de retourner un plan
// amputé comme un succès (fail-closed).
//
// Test ROUGE avant remède (callClaude n'inspecte pas stop_reason) → VERT après.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { callClaude, ClaudeApiError } from '../anthropic';

function mockFetch(payload, { ok = true, status = 200 } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('callClaude — détection troncature (P0.3)', () => {
  it('lève une erreur si stop_reason === "max_tokens"', async () => {
    mockFetch({
      stop_reason: 'max_tokens',
      content: [{ text: 'PLAN NUTRITIONNEL ... coupé en plein milieu' }],
    });
    await expect(callClaude({ system: 's', user: 'u' })).rejects.toThrow(/tronqu/i);
  });

  it('lève une ClaudeApiError taguée truncated (exploitable par les appelants)', async () => {
    mockFetch({
      stop_reason: 'max_tokens',
      content: [{ text: 'coupé' }],
    });
    await expect(callClaude({ system: 's', user: 'u' })).rejects.toBeInstanceOf(ClaudeApiError);
    await expect(callClaude({ system: 's', user: 'u' })).rejects.toMatchObject({
      payload: { truncated: true },
    });
  });

  it('throw sur troncature MÊME en mode parseJson (jamais de JSON partiel "réussi")', async () => {
    mockFetch({
      stop_reason: 'max_tokens',
      content: [{ text: '{"recipes": {"lun' }],
    });
    await expect(callClaude({ system: 's', user: 'u', parseJson: true })).rejects.toThrow(/tronqu/i);
  });

  it('throw sur troncature MÊME en mode raw', async () => {
    mockFetch({
      stop_reason: 'max_tokens',
      content: [{ text: 'coupé' }],
    });
    await expect(callClaude({ system: 's', user: 'u', raw: true })).rejects.toThrow(/tronqu/i);
  });

  it('ne lève PAS si stop_reason === "end_turn" (réponse complète)', async () => {
    mockFetch({
      stop_reason: 'end_turn',
      content: [{ text: 'plan complet' }],
    });
    await expect(callClaude({ system: 's', user: 'u' })).resolves.toBe('plan complet');
  });

  it('ne lève PAS si stop_reason absent (rétro-compat)', async () => {
    mockFetch({
      content: [{ text: 'reponse sans stop_reason' }],
    });
    await expect(callClaude({ system: 's', user: 'u' })).resolves.toBe('reponse sans stop_reason');
  });
});
