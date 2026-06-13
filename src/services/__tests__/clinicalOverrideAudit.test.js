// V97.28 — Tests du helper de traçabilité des overrides cliniques (Lot 2).
//
// Deux garanties à prouver :
//   1. Le payload inséré est correct (door exact, types extraits du verdict,
//      ids passés, overridden_by depuis getCurrentUser, snapshot verdict).
//   2. Le fail-safe est RÉEL : un reject Supabase / getCurrentUser ne doit
//      jamais faire throw traceClinicalOverride (sinon il bloquerait Anissa).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock du module supabaseClient (résolu identiquement depuis le helper qui
// importe '../supabaseClient'). insertMock / getCurrentUser pilotables par test.
const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({ insert: insertMock }));
const getCurrentUserMock = vi.fn();

vi.mock('../../supabaseClient', () => ({
  supabase: { from: (...args) => fromMock(...args) },
  getCurrentUser: (...args) => getCurrentUserMock(...args),
}));

import {
  traceClinicalOverride,
  CLINICAL_OVERRIDE_DOORS,
} from '../clinicalOverrideAudit';

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockClear();
  getCurrentUserMock.mockReset().mockResolvedValue({ email: 'anissa@example.com', id: 'u1' });
});

describe('traceClinicalOverride — payload', () => {
  it('insère dans la bonne table avec le door, les ids et l\'email', async () => {
    const verdict = {
      violations: [{ type: 'minor', severity: 'high', label: 'x' }],
      warnings: [],
    };
    await traceClinicalOverride(verdict, 'export_word', {
      clientId: 'c1',
      consultationId: 'k1',
    });

    expect(fromMock).toHaveBeenCalledWith('clinical_overrides_audit');
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.door).toBe('export_word');
    expect(payload.client_id).toBe('c1');
    expect(payload.consultation_id).toBe('k1');
    expect(payload.overridden_by).toBe('anissa@example.com');
    expect(payload.severity).toBe('high');
    expect(payload.violation_types).toEqual(['minor']);
    expect(payload.verdict).toEqual({ violations: verdict.violations, warnings: [] });
  });

  it('extrait plusieurs violation_types (cas combiné mineur + allergène)', async () => {
    const verdict = {
      violations: [
        { type: 'minor', severity: 'high' },
        { type: 'allergen', severity: 'high' },
      ],
    };
    await traceClinicalOverride(verdict, 'publish_app', { clientId: 'c2' });
    const payload = insertMock.mock.calls[0][0];
    expect(payload.violation_types).toEqual(['minor', 'allergen']);
    expect(payload.severity).toBe('high');
  });

  it('met les ids à null quand absents (Adopter brouillon / export synthétique)', async () => {
    await traceClinicalOverride({ violations: [{ type: 'minor', severity: 'high' }] }, 'adopt', {});
    const payload = insertMock.mock.calls[0][0];
    expect(payload.client_id).toBeNull();
    expect(payload.consultation_id).toBeNull();
  });

  it('met les ids à null quand ctx est omis entièrement', async () => {
    await traceClinicalOverride({ violations: [] }, 'fiche_frigo');
    const payload = insertMock.mock.calls[0][0];
    expect(payload.client_id).toBeNull();
    expect(payload.consultation_id).toBeNull();
    expect(payload.violation_types).toEqual([]);
    expect(payload.severity).toBeNull();
  });

  it('overridden_by tombe sur id si pas d\'email, puis null', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'u9' });
    await traceClinicalOverride({ violations: [] }, 'adopt');
    expect(insertMock.mock.calls[0][0].overridden_by).toBe('u9');

    insertMock.mockClear();
    getCurrentUserMock.mockResolvedValue(null);
    await traceClinicalOverride({ violations: [] }, 'adopt');
    expect(insertMock.mock.calls[0][0].overridden_by).toBeNull();
  });

  it('verdict mal formé (null / sans arrays) ne casse pas le payload', async () => {
    await traceClinicalOverride(null, 'export_word', { clientId: 'c3' });
    const payload = insertMock.mock.calls[0][0];
    expect(payload.violation_types).toEqual([]);
    expect(payload.verdict).toEqual({ violations: [], warnings: [] });
    expect(payload.severity).toBeNull();
  });

  it('libellé de porte inconnu : warn mais tente quand même l\'insert', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await traceClinicalOverride({ violations: [] }, 'word_export');
    expect(warnSpy).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0].door).toBe('word_export');
    warnSpy.mockRestore();
  });
});

describe('traceClinicalOverride — fail-safe non bloquant', () => {
  it('un reject Supabase ne fait jamais throw', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    insertMock.mockRejectedValue(new Error('network down'));
    await expect(
      traceClinicalOverride({ violations: [{ type: 'minor', severity: 'high' }] }, 'publish_app', { clientId: 'c4' }),
    ).resolves.toBeUndefined();
    errSpy.mockRestore();
  });

  it('un { error } renvoyé par Supabase ne throw pas non plus', async () => {
    insertMock.mockResolvedValue({ error: { message: 'RLS denied' } });
    await expect(
      traceClinicalOverride({ violations: [] }, 'export_word'),
    ).resolves.toBeUndefined();
  });

  it('un reject de getCurrentUser ne bloque pas : on trace avec overridden_by null', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('auth fail'));
    await expect(
      traceClinicalOverride({ violations: [{ type: 'minor', severity: 'high' }] }, 'adopt', { clientId: 'c5' }),
    ).resolves.toBeUndefined();
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0].overridden_by).toBeNull();
  });
});

describe('CLINICAL_OVERRIDE_DOORS', () => {
  it('expose exactement les 4 libellés du CHECK de la migration V97.28', () => {
    expect(Object.values(CLINICAL_OVERRIDE_DOORS).sort()).toEqual(
      ['adopt', 'export_word', 'fiche_frigo', 'publish_app'],
    );
  });
});
