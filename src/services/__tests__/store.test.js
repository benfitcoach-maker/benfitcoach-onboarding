import { describe, it, expect, beforeEach, vi } from 'vitest';

// store.js cible localStorage (synchrone) + Supabase (fire-and-forget).
// En test, import.meta.env.VITE_SUPABASE_URL est absent → supabase = null →
// isCloudEnabled = false → toutes les branches cloud sont des no-op. On peut
// donc tester la couche localStorage de maniere deterministe avec un mock.
//
// Roadmap 1.5 : filet de securite sur store.js (soft-delete, tombstones,
// versions de plan, drafts TTL, rappels). Ce sont les invariants qui, s'ils
// cassaient, feraient "disparaitre" des donnees cote Anissa.

// ─── Mock localStorage (Map-backed) installe avant l'import du module ───
function installLocalStorageMock() {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
  // Object.keys(localStorage) est utilise par purgeExpiredDrafts : on expose
  // les cles en proprietes enumerables via un Proxy.
  const proxy = new Proxy(storage, {
    ownKeys: () => [...map.keys()],
    getOwnPropertyDescriptor: (t, p) => {
      if (map.has(p)) {
        return { enumerable: true, configurable: true, value: map.get(p) };
      }
      return Object.getOwnPropertyDescriptor(t, p);
    },
    has: (t, p) => map.has(p) || p in t,
    get: (t, p) => (map.has(p) && !(p in t) ? map.get(p) : t[p]),
  });
  globalThis.localStorage = proxy;
  return map;
}

let store;

beforeEach(async () => {
  installLocalStorageMock();
  vi.resetModules();
  store = await import('../../store.js');
});

describe('clients : CRUD + tombstones', () => {
  it('saveClient cree puis getClient retrouve, getClients trie par createdAt desc', () => {
    const a = store.saveClient({ id: 'c1', prenom: 'Alice' });
    expect(a.id).toBe('c1');
    expect(store.getClient('c1')?.prenom).toBe('Alice');
    expect(store.getClients()).toHaveLength(1);
  });

  it('saveClient sur id existant fait un merge (pas de doublon)', () => {
    store.saveClient({ id: 'c1', prenom: 'Alice' });
    store.saveClient({ id: 'c1', prenom: 'Alice', formule: 'suivi' });
    const list = store.getClients();
    expect(list).toHaveLength(1);
    expect(list[0].formule).toBe('suivi');
  });

  it('deleteClient pose un tombstone : getClient renvoie null', () => {
    store.saveClient({ id: 'c1', prenom: 'Alice' });
    store.deleteClient('c1');
    expect(store.getClient('c1')).toBeNull();
    expect(store.getClients()).toHaveLength(0);
  });
});

describe('consultations nutrition : soft-delete', () => {
  it('saveNutritionConsultation puis lecture filtree par clientId', () => {
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: '2026-01-01' });
    store.saveNutritionConsultation({ id: 'n2', clientId: 'c2', date: '2026-01-02' });
    const c1 = store.getNutritionConsultations('c1');
    expect(c1).toHaveLength(1);
    expect(c1[0].id).toBe('n1');
  });

  it('softDeleteConsultation masque la consultation des lectures', () => {
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: '2026-01-01' });
    expect(store.softDeleteConsultation('n1', 'anissa')).toBe(true);
    expect(store.getNutritionConsultations('c1')).toHaveLength(0);
  });

  it('softDeleteConsultation est idempotent', () => {
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: '2026-01-01' });
    expect(store.softDeleteConsultation('n1')).toBe(true);
    expect(store.softDeleteConsultation('n1')).toBe(true); // 2e appel = no-op true
  });

  it('softDeleteConsultation sur id inconnu renvoie false', () => {
    expect(store.softDeleteConsultation('ghost')).toBe(false);
    expect(store.softDeleteConsultation(null)).toBe(false);
  });

  it('re-save d\'une consultation soft-deletee NE la ressuscite PAS (V78)', () => {
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: '2026-01-01' });
    store.softDeleteConsultation('n1', 'anissa');
    // Anissa re-edite/sauvegarde la meme consultation sans connaitre le flag.
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: '2026-01-01', nutritionPlan: 'edit' });
    // Doit rester invisible : pas d'undelete silencieux.
    expect(store.getNutritionConsultations('c1')).toHaveLength(0);
  });
});

describe('progression : ajout / suppression', () => {
  it('addProgressionEntry ajoute et trie par date asc', () => {
    store.saveClient({ id: 'c1', prenom: 'Alice' });
    store.addProgressionEntry('c1', { date: '2026-02-01', poids: 70 });
    store.addProgressionEntry('c1', { date: '2026-01-01', poids: 72 });
    const c = store.getClient('c1');
    expect(c.progression.map(p => p.date)).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('deleteProgressionEntry retire l\'entree ciblee', () => {
    store.saveClient({ id: 'c1', prenom: 'Alice' });
    const c = store.addProgressionEntry('c1', { date: '2026-01-01', poids: 72 });
    const entryId = c.progression[0].id;
    store.deleteProgressionEntry('c1', entryId);
    expect(store.getClient('c1').progression).toHaveLength(0);
  });
});

describe('versions de plan : cap a 3', () => {
  it('savePlanVersion conserve au maximum 3 versions (les plus recentes)', () => {
    for (let i = 1; i <= 5; i++) {
      store.savePlanVersion('c1', { label: `v${i}`, nutritionPlan: `plan ${i}` });
    }
    const versions = store.getPlanVersions('c1');
    expect(versions).toHaveLength(3);
    // unshift → la plus recente en tete : v5, v4, v3
    expect(versions.map(v => v.label)).toEqual(['v5', 'v4', 'v3']);
  });

  it('deletePlanVersion retire la version ciblee', () => {
    const v = store.savePlanVersion('c1', { label: 'v1' });
    store.deletePlanVersion('c1', v.id);
    expect(store.getPlanVersions('c1')).toHaveLength(0);
  });
});

describe('frequence de rappel', () => {
  it('defaut = 3 mois quand non defini', () => {
    expect(store.getClientReminderFrequency('c1')).toBe(store.DEFAULT_REMINDER_MONTHS);
    expect(store.DEFAULT_REMINDER_MONTHS).toBe(3);
  });

  it('set puis get conserve la valeur ; valeur invalide retombe au defaut', () => {
    store.setClientReminderFrequency('c1', 6);
    expect(store.getClientReminderFrequency('c1')).toBe(6);
    store.setClientReminderFrequency('c1', 0); // invalide → suppression
    expect(store.getClientReminderFrequency('c1')).toBe(store.DEFAULT_REMINDER_MONTHS);
  });
});

describe('drafts : TTL 7 jours', () => {
  it('saveDraft puis loadDraft retourne le brouillon recent', () => {
    store.saveDraft('c1', 'n1', { plan: 'p', supplements: 's', recipes: 'r' });
    const d = store.loadDraft('c1', 'n1');
    expect(d?.plan).toBe('p');
  });

  it('loadDraft ignore (et purge) un brouillon de plus de 7 jours', () => {
    store.saveDraft('c1', 'n1', { plan: 'p' });
    // Vieillir artificiellement le draft au-dela du TTL.
    const key = store.getDraftKey('c1', 'n1');
    const entry = JSON.parse(localStorage.getItem(key));
    entry.savedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(key, JSON.stringify(entry));
    expect(store.loadDraft('c1', 'n1')).toBeNull();
    expect(localStorage.getItem(key)).toBeNull(); // purge effectuee
  });

  it('purgeExpiredDrafts supprime les expires et garde les recents', () => {
    store.saveDraft('c1', 'fresh', { plan: 'ok' });
    store.saveDraft('c1', 'old', { plan: 'stale' });
    const oldKey = store.getDraftKey('c1', 'old');
    const e = JSON.parse(localStorage.getItem(oldKey));
    e.savedAt = Date.now() - 10 * 24 * 60 * 60 * 1000;
    localStorage.setItem(oldKey, JSON.stringify(e));
    store.purgeExpiredDrafts();
    expect(localStorage.getItem(oldKey)).toBeNull();
    expect(store.loadDraft('c1', 'fresh')?.plan).toBe('ok');
  });
});

describe('export / import', () => {
  it('exportAllData puis importAllData restitue les clients', () => {
    store.saveClient({ id: 'c1', prenom: 'Alice', formule: 'suivi' });
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: '2026-01-01' });
    const json = store.exportAllData();
    // Repartir d'un storage vierge.
    installLocalStorageMock();
    const count = store.importAllData(json);
    expect(count).toBe(1);
    expect(store.getClient('c1')?.prenom).toBe('Alice');
    expect(store.getNutritionConsultations('c1')).toHaveLength(1);
  });

  it('importAllData rejette un format invalide', () => {
    expect(() => store.importAllData('{}')).toThrow();
  });
});

describe('rappels de consultation', () => {
  it('syncReminderNotifications cree un rappel pour une consultation en retard', () => {
    store.saveClient({ id: 'c1', prenom: 'Alice' });
    const old = new Date();
    old.setMonth(old.getMonth() - 6); // 6 mois > frequence par defaut 3 mois
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: old.toISOString() });
    store.syncReminderNotifications([store.getClient('c1')]);
    const reminders = store.getNotifications().filter(n => n.type === 'consultation_reminder');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].clientId).toBe('c1');
  });

  it('aucun rappel si la derniere consultation est recente', () => {
    store.saveClient({ id: 'c1', prenom: 'Alice' });
    store.saveNutritionConsultation({ id: 'n1', clientId: 'c1', date: new Date().toISOString() });
    store.syncReminderNotifications([store.getClient('c1')]);
    expect(store.getNotifications().filter(n => n.type === 'consultation_reminder')).toHaveLength(0);
  });
});
