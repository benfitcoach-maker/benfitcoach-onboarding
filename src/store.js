const STORAGE_KEY = 'bfc_clients';

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
  return clients.find(c => c.id === client.id) || clients[clients.length - 1];
}

export function deleteClient(id) {
  writeAll(readAll().filter(c => c.id !== id));
}

export function addGeneration(clientId, sections) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  if (!client.history) client.history = [];
  client.history.unshift({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    sections,
  });
  client.latestSections = sections;
  client.updatedAt = new Date().toISOString();
  if (client.status === 'nouveau') client.status = 'actif';
  writeAll(clients);
  return client;
}

export function updateClientStatus(id, status) {
  const clients = readAll();
  const client = clients.find(c => c.id === id);
  if (!client) return;
  client.status = status;
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
}

export function updateClientSection(clientId, sectionTitle, content) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.latestSections) return;
  client.latestSections[sectionTitle] = content;
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
}

// Progression tracking
export function addProgressionEntry(clientId, entry) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  if (!client.progression) client.progression = [];
  client.progression.push({
    id: crypto.randomUUID(),
    date: entry.date || new Date().toISOString().split('T')[0],
    poids: entry.poids,
    comment: entry.comment || '',
  });
  client.progression.sort((a, b) => new Date(a.date) - new Date(b.date));
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  return client;
}

export function deleteProgressionEntry(clientId, entryId) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.progression) return;
  client.progression = client.progression.filter(e => e.id !== entryId);
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
}

// Massage session notes
export function addMassageSession(clientId, session) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  if (!client.massageSessions) client.massageSessions = [];
  client.massageSessions.unshift({
    id: crypto.randomUUID(),
    date: session.date || new Date().toISOString().split('T')[0],
    zonesTraitees: session.zonesTraitees || '',
    techniques: session.techniques || '',
    observations: session.observations || '',
    recommandations: session.recommandations || '',
  });
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  return client;
}

export function deleteMassageSession(clientId, sessionId) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.massageSessions) return;
  client.massageSessions = client.massageSessions.filter(s => s.id !== sessionId);
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
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
  return data.clients.length;
}
