import { describe, it, expect } from 'vitest';
import { requireSaaSAdmin } from './_security.js';

// Tests du guard requireSaaSAdmin (V97.34) sans mock reseau : on injecte
// deps.resolveUser pour simuler le resultat de la validation GoTrue. On couvre
// les 4 issues (token absent / invalide / non-admin / admin) + le mapping
// d'erreur de config + le parsing du header Bearer.

const reqWith = (authorization) => ({ headers: authorization ? { authorization } : {} });

// Un email present dans l'allowlist SaaS (cf. _security.js SAAS_ADMIN_EMAILS).
const ADMIN_EMAIL = 'anissa.nutri@gmail.com';

describe('requireSaaSAdmin', () => {
  it('401 si aucun header Authorization', async () => {
    const r = await requireSaaSAdmin(reqWith(undefined), { resolveUser: async () => null });
    expect(r).toEqual({ ok: false, status: 401, error: 'Unauthorized' });
  });

  it('401 si Bearer present mais token vide', async () => {
    const r = await requireSaaSAdmin(reqWith('Bearer   '), { resolveUser: async () => ({ email: ADMIN_EMAIL }) });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it('401 si le token ne resout aucun user (token invalide/expire)', async () => {
    let received;
    const r = await requireSaaSAdmin(reqWith('Bearer faketoken'), {
      resolveUser: async (t) => { received = t; return null; },
    });
    expect(received).toBe('faketoken');
    expect(r).toEqual({ ok: false, status: 401, error: 'Unauthorized' });
  });

  it('500 si la config Supabase serveur est absente', async () => {
    const r = await requireSaaSAdmin(reqWith('Bearer x'), {
      resolveUser: async () => { throw new Error('SUPABASE_NOT_CONFIGURED'); },
    });
    expect(r).toEqual({ ok: false, status: 500, error: 'Supabase not configured server-side' });
  });

  it('401 si resolveUser leve une erreur reseau quelconque', async () => {
    const r = await requireSaaSAdmin(reqWith('Bearer x'), {
      resolveUser: async () => { throw new Error('network down'); },
    });
    expect(r).toEqual({ ok: false, status: 401, error: 'Unauthorized' });
  });

  it('403 si user valide mais email hors allowlist admin', async () => {
    const r = await requireSaaSAdmin(reqWith('Bearer x'), {
      resolveUser: async () => ({ email: 'cliente@example.com' }),
    });
    expect(r).toEqual({ ok: false, status: 403, error: 'Forbidden' });
  });

  it('ok:true + user si email admin (Anissa)', async () => {
    const user = { id: 'u1', email: ADMIN_EMAIL };
    const r = await requireSaaSAdmin(reqWith(`Bearer realtoken`), { resolveUser: async () => user });
    expect(r).toEqual({ ok: true, user });
  });

  it('email admin insensible a la casse', async () => {
    const r = await requireSaaSAdmin(reqWith('Bearer x'), {
      resolveUser: async () => ({ id: 'u2', email: 'Anissa.Nutri@GMAIL.com' }),
    });
    expect(r.ok).toBe(true);
  });

  it('extrait le token apres le prefixe Bearer (case-insensitive)', async () => {
    let received;
    await requireSaaSAdmin(reqWith('bearer abc.def.ghi'), {
      resolveUser: async (t) => { received = t; return null; },
    });
    expect(received).toBe('abc.def.ghi');
  });
});
