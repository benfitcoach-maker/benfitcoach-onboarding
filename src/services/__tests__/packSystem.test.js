// V96.27 — Tests buildPackFollowupSchedule + getNextPendingStep.
// Verifie que la timeline ne demarre qu'apres marquage manuel de la remise
// du programme (packStartedAtConfirmed = true).

import { describe, it, expect } from 'vitest';
import {
  buildPackFollowupSchedule,
  getNextPendingStep,
  PACK_DEFINITIONS,
} from '../packSystem';

const today = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

describe('buildPackFollowupSchedule — V96.27 demarrage manuel', () => {
  it('Pack oneshot retourne [] (pas de steps)', () => {
    const r = buildPackFollowupSchedule({
      packType: 'oneshot_180',
      createdAt: today(),
    });
    expect(r).toEqual([]);
  });

  it('Pack suivi sans packStartedAtConfirmed -> schedule vide (en attente remise)', () => {
    const r = buildPackFollowupSchedule({
      packType: 'suivi_3m',
      createdAt: daysAgo(30),  // client cree il y a 30 jours
      packStartedAt: null,
      packStartedAtConfirmed: false,
    });
    expect(r).toEqual([]);
  });

  it('Pack suivi avec packStartedAt mais pas confirme -> schedule vide', () => {
    const r = buildPackFollowupSchedule({
      packType: 'suivi_3m',
      createdAt: daysAgo(30),
      packStartedAt: daysAgo(20),
      packStartedAtConfirmed: false,  // pas confirme
    });
    expect(r).toEqual([]);
  });

  it('Pack suivi confirme -> schedule complet (3 steps pour suivi_3m)', () => {
    const r = buildPackFollowupSchedule({
      packType: 'suivi_3m',
      createdAt: daysAgo(20),
      packStartedAt: daysAgo(0),  // remis aujourd'hui
      packStartedAtConfirmed: true,
    });
    expect(r.length).toBe(3);
    expect(r[0].weekOffset).toBe(4);
    expect(r[1].weekOffset).toBe(8);
    expect(r[2].weekOffset).toBe(12);
  });

  it('Steps calcules depuis packStartedAt (pas createdAt)', () => {
    const startedAt = daysAgo(0);
    const r = buildPackFollowupSchedule({
      packType: 'suivi_3m',
      createdAt: daysAgo(60),  // cree il y a 2 mois
      packStartedAt: startedAt,
      packStartedAtConfirmed: true,
    });
    // Step S4 due ~28 jours apres startedAt
    const step4 = r[0];
    const due = new Date(step4.dueDate);
    const start = new Date(startedAt);
    const diffDays = Math.round((due - start) / 86400000);
    expect(diffDays).toBe(28);  // 4 semaines
  });

  it('isLate true si dueDate passee et pas done', () => {
    const r = buildPackFollowupSchedule({
      packType: 'suivi_3m',
      createdAt: daysAgo(60),
      packStartedAt: daysAgo(45),  // remis il y a 45 jours
      packStartedAtConfirmed: true,
    });
    // S4 (28j) deja passe il y a 17j -> en retard
    expect(r[0].isLate).toBe(true);
    // S8 (56j) toujours dans le futur a J45 -> pas en retard
    expect(r[1].isLate).toBe(false);
  });

  it('Pack suivi_6m a 5 steps (S4, S8, S12, S16, S24)', () => {
    const r = buildPackFollowupSchedule({
      packType: 'suivi_6m',
      packStartedAt: today(),
      packStartedAtConfirmed: true,
    });
    expect(r.length).toBe(5);
    expect(r.map(s => s.weekOffset)).toEqual([4, 8, 12, 16, 24]);
  });
});

describe('getNextPendingStep — V96.27', () => {
  it('Retourne null si pas confirme (schedule vide)', () => {
    const r = getNextPendingStep({
      packType: 'suivi_3m',
      createdAt: today(),
      packStartedAtConfirmed: false,
    });
    expect(r).toBeNull();
  });

  it('Retourne la 1ere step pending si confirme', () => {
    const r = getNextPendingStep({
      packType: 'suivi_3m',
      packStartedAt: today(),
      packStartedAtConfirmed: true,
    });
    expect(r).not.toBeNull();
    expect(r.stepNumber).toBe(1);
    expect(r.weekOffset).toBe(4);
  });
});

describe('PACK_DEFINITIONS — sanity', () => {
  it('Tous les packs definis avec label + steps array', () => {
    for (const [key, pack] of Object.entries(PACK_DEFINITIONS)) {
      expect(pack.label, `Pack ${key} doit avoir un label`).toBeTruthy();
      expect(Array.isArray(pack.steps), `Pack ${key}.steps doit etre un array`).toBe(true);
    }
  });
});
