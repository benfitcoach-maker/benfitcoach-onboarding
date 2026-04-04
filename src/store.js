import { supabase, isCloudEnabled } from './supabaseClient';

const STORAGE_KEY = 'bfc_clients';
const SYNC_QUEUE_KEY = 'bfc_sync_queue';

// ─── localStorage helpers (always synchronous) ───

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeAll(clients) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

// ─── Sync queue for offline operations ───

function getSyncQueue() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSyncQueue(queue) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function addToSyncQueue(operation) {
  const queue = getSyncQueue();
  queue.push({ ...operation, timestamp: Date.now() });
  saveSyncQueue(queue);
}

// ─── Cloud sync (fire-and-forget after localStorage writes) ───

function cloudSyncClient(client) {
  if (!isCloudEnabled) return;
  const { history, progression, massageSessions, ...rest } = client;
  const row = {
    id: rest.id,
    categorie: rest.categorie || 'online',
    prenom: rest.prenom || '',
    formule: rest.formule || '',
    langue: rest.langue || 'FR',
    status: rest.status || 'nouveau',
    form: rest.form || {},
    latest_sections: rest.latestSections || null,
    created_at: rest.createdAt || new Date().toISOString(),
    updated_at: rest.updatedAt || new Date().toISOString(),
  };
  supabase.from('clients').upsert(row).then(({ error }) => {
    if (error) {
      console.warn('Cloud sync client failed:', error.message);
      addToSyncQueue({ type: 'upsert_client', data: row });
    }
  });
}

function cloudDeleteClient(id) {
  if (!isCloudEnabled) return;
  supabase.from('clients').delete().eq('id', id).then(({ error }) => {
    if (error) {
      console.warn('Cloud delete client failed:', error.message);
      addToSyncQueue({ type: 'delete_client', data: { id } });
    }
  });
}

function cloudSyncGeneration(clientId, gen) {
  if (!isCloudEnabled) return;
  const row = {
    id: gen.id,
    client_id: clientId,
    date: gen.date,
    sections: gen.sections,
  };
  supabase.from('generations').upsert(row).then(({ error }) => {
    if (error) {
      console.warn('Cloud sync generation failed:', error.message);
      addToSyncQueue({ type: 'upsert_generation', data: row });
    }
  });
}

function cloudSyncProgression(clientId, entry) {
  if (!isCloudEnabled) return;
  const row = {
    id: entry.id,
    client_id: clientId,
    date: entry.date,
    poids: entry.poids ? Number(entry.poids) : null,
    comment: entry.comment || '',
  };
  supabase.from('progression').upsert(row).then(({ error }) => {
    if (error) {
      addToSyncQueue({ type: 'upsert_progression', data: row });
    }
  });
}

function cloudDeleteProgression(entryId) {
  if (!isCloudEnabled) return;
  supabase.from('progression').delete().eq('id', entryId).then(({ error }) => {
    if (error) addToSyncQueue({ type: 'delete_progression', data: { id: entryId } });
  });
}

function cloudSyncMassageSession(clientId, session) {
  if (!isCloudEnabled) return;
  const row = {
    id: session.id,
    client_id: clientId,
    date: session.date,
    zones_traitees: session.zonesTraitees || '',
    techniques: session.techniques || '',
    observations: session.observations || '',
    recommandations: session.recommandations || '',
  };
  supabase.from('massage_sessions').upsert(row).then(({ error }) => {
    if (error) addToSyncQueue({ type: 'upsert_massage_session', data: row });
  });
}

function cloudDeleteMassageSession(sessionId) {
  if (!isCloudEnabled) return;
  supabase.from('massage_sessions').delete().eq('id', sessionId).then(({ error }) => {
    if (error) addToSyncQueue({ type: 'delete_massage_session', data: { id: sessionId } });
  });
}

// ─── Full cloud pull (on login / app start) ───

export async function pullFromCloud() {
  if (!isCloudEnabled) return { synced: false };

  try {
    const [clientsRes, gensRes, sessionsRes, progRes] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('generations').select('*'),
      supabase.from('massage_sessions').select('*'),
      supabase.from('progression').select('*'),
    ]);

    if (clientsRes.error) throw clientsRes.error;

    const cloudClients = clientsRes.data || [];
    const cloudGens = gensRes.data || [];
    const cloudSessions = sessionsRes.data || [];
    const cloudProg = progRes.data || [];

    // Group related data by client_id
    const gensByClient = {};
    for (const g of cloudGens) {
      if (!gensByClient[g.client_id]) gensByClient[g.client_id] = [];
      gensByClient[g.client_id].push({ id: g.id, date: g.date, sections: g.sections });
    }

    const sessionsByClient = {};
    for (const s of cloudSessions) {
      if (!sessionsByClient[s.client_id]) sessionsByClient[s.client_id] = [];
      sessionsByClient[s.client_id].push({
        id: s.id, date: s.date,
        zonesTraitees: s.zones_traitees, techniques: s.techniques,
        observations: s.observations, recommandations: s.recommandations,
      });
    }

    const progByClient = {};
    for (const p of cloudProg) {
      if (!progByClient[p.client_id]) progByClient[p.client_id] = [];
      progByClient[p.client_id].push({
        id: p.id, date: p.date,
        poids: p.poids, comment: p.comment,
      });
    }

    // Build cloud client objects in localStorage format
    const cloudMap = {};
    for (const c of cloudClients) {
      const history = (gensByClient[c.id] || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      const progression = (progByClient[c.id] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
      const massageSessions = (sessionsByClient[c.id] || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      cloudMap[c.id] = {
        id: c.id,
        categorie: c.categorie || 'online',
        prenom: c.prenom || '',
        formule: c.formule || '',
        langue: c.langue || 'FR',
        status: c.status || 'nouveau',
        form: c.form || {},
        latestSections: c.latest_sections || null,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        history,
        progression,
        massageSessions,
      };
    }

    // Merge with localStorage
    const localClients = readAll();
    const localMap = {};
    for (const c of localClients) {
      localMap[c.id] = c;
    }

    const merged = {};

    // All cloud clients
    for (const [id, cloudClient] of Object.entries(cloudMap)) {
      const local = localMap[id];
      if (!local) {
        merged[id] = cloudClient;
      } else {
        // Keep the newer one
        const cloudDate = new Date(cloudClient.updatedAt || 0);
        const localDate = new Date(local.updatedAt || 0);
        if (cloudDate >= localDate) {
          // Cloud wins, but merge arrays (union by id)
          merged[id] = {
            ...cloudClient,
            history: mergeArraysById(cloudClient.history, local.history),
            progression: mergeArraysById(cloudClient.progression, local.progression),
            massageSessions: mergeArraysById(cloudClient.massageSessions, local.massageSessions),
          };
        } else {
          // Local wins, but merge arrays
          merged[id] = {
            ...local,
            history: mergeArraysById(local.history, cloudClient.history),
            progression: mergeArraysById(local.progression, cloudClient.progression),
            massageSessions: mergeArraysById(local.massageSessions, cloudClient.massageSessions),
          };
        }
      }
    }

    // Local-only clients (not in cloud)
    for (const [id, local] of Object.entries(localMap)) {
      if (!cloudMap[id]) {
        merged[id] = local;
      }
    }

    const mergedList = Object.values(merged);
    writeAll(mergedList);

    // Push local-only data to cloud
    for (const client of mergedList) {
      if (!cloudMap[client.id]) {
        cloudSyncClient(client);
        // Also push related data
        for (const gen of (client.history || [])) {
          cloudSyncGeneration(client.id, gen);
        }
        for (const prog of (client.progression || [])) {
          cloudSyncProgression(client.id, prog);
        }
        for (const session of (client.massageSessions || [])) {
          cloudSyncMassageSession(client.id, session);
        }
      }
    }

    return { synced: true, count: mergedList.length };
  } catch (err) {
    console.warn('Pull from cloud failed:', err.message);
    return { synced: false, error: err.message };
  }
}

function mergeArraysById(a = [], b = []) {
  const map = {};
  for (const item of a) map[item.id] = item;
  for (const item of b) {
    if (!map[item.id]) map[item.id] = item;
  }
  return Object.values(map);
}

// ─── Retry queued operations ───

export async function retrySyncQueue() {
  if (!isCloudEnabled) return;
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const op of queue) {
    let error = null;
    switch (op.type) {
      case 'upsert_client':
        ({ error } = await supabase.from('clients').upsert(op.data));
        break;
      case 'delete_client':
        ({ error } = await supabase.from('clients').delete().eq('id', op.data.id));
        break;
      case 'upsert_generation':
        ({ error } = await supabase.from('generations').upsert(op.data));
        break;
      case 'upsert_progression':
        ({ error } = await supabase.from('progression').upsert(op.data));
        break;
      case 'delete_progression':
        ({ error } = await supabase.from('progression').delete().eq('id', op.data.id));
        break;
      case 'upsert_massage_session':
        ({ error } = await supabase.from('massage_sessions').upsert(op.data));
        break;
      case 'delete_massage_session':
        ({ error } = await supabase.from('massage_sessions').delete().eq('id', op.data.id));
        break;
    }
    if (error) remaining.push(op);
  }
  saveSyncQueue(remaining);
}

// ─── Public API (same signatures as before) ───

export function getClients() {
  return readAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getClient(id) {
  return readAll().find(c => c.id === id) || null;
}

export function saveClient(client) {
  const clients = readAll();
  const idx = clients.findIndex(c => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = { ...clients[idx], ...client, updatedAt: new Date().toISOString() };
  } else {
    clients.push({
      ...client,
      id: client.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'nouveau',
      history: [],
      progression: [],
      massageSessions: [],
    });
  }
  writeAll(clients);
  const saved = clients.find(c => c.id === client.id) || clients[clients.length - 1];
  cloudSyncClient(saved);
  return saved;
}

export function deleteClient(id) {
  writeAll(readAll().filter(c => c.id !== id));
  cloudDeleteClient(id);
}

export function addGeneration(clientId, sections) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  if (!client.history) client.history = [];
  const gen = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    sections,
  };
  client.history.unshift(gen);
  client.latestSections = sections;
  client.updatedAt = new Date().toISOString();
  if (client.status === 'nouveau') client.status = 'actif';
  writeAll(clients);
  cloudSyncClient(client);
  cloudSyncGeneration(clientId, gen);
  return client;
}

export function updateClientStatus(id, status) {
  const clients = readAll();
  const client = clients.find(c => c.id === id);
  if (!client) return;
  client.status = status;
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  cloudSyncClient(client);
}

export function updateClientSection(clientId, sectionTitle, content) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.latestSections) return;
  client.latestSections[sectionTitle] = content;
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  cloudSyncClient(client);
}

// Progression tracking
export function addProgressionEntry(clientId, entry) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  if (!client.progression) client.progression = [];
  const progEntry = {
    id: crypto.randomUUID(),
    date: entry.date || new Date().toISOString().split('T')[0],
    poids: entry.poids,
    comment: entry.comment || '',
  };
  client.progression.push(progEntry);
  client.progression.sort((a, b) => new Date(a.date) - new Date(b.date));
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  cloudSyncProgression(clientId, progEntry);
  return client;
}

export function deleteProgressionEntry(clientId, entryId) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.progression) return;
  client.progression = client.progression.filter(e => e.id !== entryId);
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  cloudDeleteProgression(entryId);
}

// Massage session notes
export function addMassageSession(clientId, session) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  if (!client.massageSessions) client.massageSessions = [];
  const sessionEntry = {
    id: crypto.randomUUID(),
    date: session.date || new Date().toISOString().split('T')[0],
    zonesTraitees: session.zonesTraitees || '',
    techniques: session.techniques || '',
    observations: session.observations || '',
    recommandations: session.recommandations || '',
  };
  client.massageSessions.unshift(sessionEntry);
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  cloudSyncMassageSession(clientId, sessionEntry);
  return client;
}

export function deleteMassageSession(clientId, sessionId) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.massageSessions) return;
  client.massageSessions = client.massageSessions.filter(s => s.id !== sessionId);
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  cloudDeleteMassageSession(sessionId);
}

// Export/Import
export function exportAllData() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    clients: readAll(),
    apiKey: localStorage.getItem('bfc_api_key') || '',
  }, null, 2);
}

export function importAllData(jsonString) {
  const data = JSON.parse(jsonString);
  if (!data.clients || !Array.isArray(data.clients)) {
    throw new Error('Format invalide: pas de tableau clients');
  }
  writeAll(data.clients);
  if (data.apiKey) {
    localStorage.setItem('bfc_api_key', data.apiKey);
  }
  // Push imported data to cloud
  if (isCloudEnabled) {
    for (const client of data.clients) {
      cloudSyncClient(client);
      for (const gen of (client.history || [])) cloudSyncGeneration(client.id, gen);
      for (const prog of (client.progression || [])) cloudSyncProgression(client.id, prog);
      for (const session of (client.massageSessions || [])) cloudSyncMassageSession(client.id, session);
    }
  }
  return data.clients.length;
}
