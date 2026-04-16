import { supabase, isCloudEnabled } from './supabaseClient';
import { computeMetrics } from './bodyMetrics';

async function getCurrentOwnerId() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

function toNumOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function round1OrNull(v) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}

const STORAGE_KEY = 'bfc_clients';
const NUTRITION_KEY = 'bfc_nutrition_consultations';
const SYNC_QUEUE_KEY = 'bfc_sync_queue';
const NOTIFICATIONS_KEY = 'bfc_notifications';
const DELETED_IDS_KEY = 'bfc_deleted_ids';

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

function readNutritionConsultations() {
  try {
    return JSON.parse(localStorage.getItem(NUTRITION_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeNutritionConsultations(consultations) {
  localStorage.setItem(NUTRITION_KEY, JSON.stringify(consultations));
}

// ─── Tombstone registry: tracks intentionally deleted client IDs ───
// Prevents pullFromCloud() from resurrecting deleted clients ("zombie" bug).

function readDeletedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || '[]');
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const result = new Map();
    for (const entry of raw) {
      // Compatibilité avec l'ancien format (simple string)
      if (typeof entry === 'string') {
        result.set(entry, Date.now());
      } else if (entry?.id && entry.deletedAt > cutoff) {
        result.set(entry.id, entry.deletedAt);
      }
    }
    // Réécrire avec les entrées purgées
    const toStore = [...result.entries()].map(([id, deletedAt]) => ({ id, deletedAt }));
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(toStore));
    return result;
  } catch {
    return new Map();
  }
}

function addDeletedId(id) {
  const entries = readDeletedIds();
  entries.set(id, Date.now());
  const toStore = [...entries.entries()].map(([id, deletedAt]) => ({ id, deletedAt }));
  localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(toStore));
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

async function cloudSyncClient(client) {
  if (!isCloudEnabled) return;
  const ownerId = await getCurrentOwnerId();
  const { history, progression, massageSessions, ...rest } = client;
  const f = rest.form || {};
  const metrics = computeMetrics(f);
  const row = {
    id: rest.id,
    owner_id: ownerId,
    categorie: rest.categorie || 'online',
    prenom: rest.prenom || '',
    formule: rest.formule || '',
    langue: rest.langue || 'FR',
    status: rest.status || 'nouveau',
    form: f,
    custom_rate: f.customRate ? Number(f.customRate) : null,
    waist_cm: toNumOrNull(f.tourTaille),
    hip_cm: toNumOrNull(f.tourHanche),
    neck_cm: toNumOrNull(f.tourCou),
    chest_cm: toNumOrNull(f.tourPoitrine),
    arm_right_cm: toNumOrNull(f.tourBrasDroit),
    arm_left_cm: toNumOrNull(f.tourBrasGauche),
    thigh_right_cm: toNumOrNull(f.tourCuisseDroite),
    thigh_left_cm: toNumOrNull(f.tourCuisseGauche),
    calf_cm: toNumOrNull(f.tourMollet),
    body_fat_percent: round1OrNull(metrics.bodyFat),
    lean_mass_kg: round1OrNull(metrics.leanMass),
    bmr_kcal: metrics.bmr != null ? Math.round(metrics.bmr) : null,
    interview_notes: rest.interviewNotes || null,
    latest_sections: rest.latestSections || null,
    created_by: rest.createdBy || 'benoit',
    created_at: rest.createdAt || new Date().toISOString(),
    updated_at: rest.updatedAt || new Date().toISOString(),
  };
  supabase.from('clients').upsert(row, { onConflict: 'id' }).then(({ error }) => {
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

async function cloudSyncGeneration(clientId, gen) {
  if (!isCloudEnabled) return;
  const ownerId = await getCurrentOwnerId();
  const row = {
    id: gen.id,
    owner_id: ownerId,
    client_id: clientId,
    date: gen.date,
    sections: gen.sections,
  };
  supabase.from('generations').upsert(row, { onConflict: 'id' }).then(({ error }) => {
    if (error) {
      console.warn('Cloud sync generation failed:', error.message);
      addToSyncQueue({ type: 'upsert_generation', data: row });
    }
  });
}

async function cloudSyncProgression(clientId, entry) {
  if (!isCloudEnabled) return;
  const ownerId = await getCurrentOwnerId();
  const row = {
    id: entry.id,
    owner_id: ownerId,
    client_id: clientId,
    date: entry.date,
    poids: entry.poids ? Number(entry.poids) : null,
    comment: entry.comment || '',
  };
  supabase.from('progression').upsert(row, { onConflict: 'id' }).then(({ error }) => {
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

async function cloudSyncMassageSession(clientId, session) {
  if (!isCloudEnabled) return;
  const ownerId = await getCurrentOwnerId();
  const row = {
    id: session.id,
    owner_id: ownerId,
    client_id: clientId,
    date: session.date,
    zones_traitees: session.zonesTraitees || '',
    techniques: session.techniques || '',
    observations: session.observations || '',
    recommandations: session.recommandations || '',
  };
  supabase.from('massage_sessions').upsert(row, { onConflict: 'id' }).then(({ error }) => {
    if (error) addToSyncQueue({ type: 'upsert_massage_session', data: row });
  });
}

function cloudDeleteMassageSession(sessionId) {
  if (!isCloudEnabled) return;
  supabase.from('massage_sessions').delete().eq('id', sessionId).then(({ error }) => {
    if (error) addToSyncQueue({ type: 'delete_massage_session', data: { id: sessionId } });
  });
}

async function cloudSyncNutritionConsultation(consultation) {
  if (!isCloudEnabled) return;
  const ownerId = await getCurrentOwnerId();
  const row = {
    id: consultation.id,
    owner_id: ownerId,
    client_id: consultation.clientId,
    consultant_name: consultation.consultantName || 'Anissa',
    date: consultation.date,
    observations: consultation.observations || '',
    blood_test_done: consultation.bloodTestDone || false,
    dna_test_done: consultation.dnaTestDone || false,
    nutritional_observations: consultation.nutritionalObservations || '',
    nutrition_plan: consultation.nutritionPlan || '',
    supplements: consultation.supplements || '',
    recipes: consultation.recipes || '',
    fiche_frigo_json: consultation.ficheFrigoJson || null,
    lab_results: consultation.labResults || null,
    notes_for_coach: consultation.notesForCoach || '',
    private_notes: consultation.privateNotes || '',
    is_followup: consultation.isFollowup || false,
    followup_data: consultation.followupData || null,
    previous_consultation_id: consultation.previousConsultationId || null,
    mgd_recommendation: consultation.mgdRecommendation || 'none',
    status: consultation.status || 'questionnaire_recu',
    created_at: consultation.createdAt || new Date().toISOString(),
  };
  supabase.from('nutrition_consultations').upsert(row, { onConflict: 'id' }).then(({ error }) => {
    if (error) {
      console.warn('Cloud sync nutrition consultation failed:', error.message);
      addToSyncQueue({ type: 'upsert_nutrition_consultation', data: row });
    }
  });
}

export async function saveApiKeyToCloud(apiKey) {
  if (!isCloudEnabled || !apiKey) return;
  await supabase
    .from('app_config')
    .upsert({ key: 'anthropic_api_key', value: apiKey });
}

export async function loadApiKeyFromCloud() {
  if (!isCloudEnabled) return null;
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'anthropic_api_key')
    .single();
  return data?.value || null;
}

export async function forceSyncAllConsultations() {
  if (!isCloudEnabled) return { synced: 0, errors: 0 };
  const ownerId = await getCurrentOwnerId();
  const consultations = readNutritionConsultations();
  let synced = 0, errors = 0;
  for (const c of consultations) {
    const row = {
      id: c.id,
      owner_id: ownerId,
      client_id: c.clientId,
      consultant_name: c.consultantName || 'Anissa',
      date: c.date,
      observations: c.observations || '',
      blood_test_done: c.bloodTestDone || false,
      dna_test_done: c.dnaTestDone || false,
      nutritional_observations: c.nutritionalObservations || '',
      nutrition_plan: c.nutritionPlan || '',
      supplements: c.supplements || '',
      recipes: c.recipes || '',
      fiche_frigo_json: c.ficheFrigoJson || null,
      lab_results: c.labResults || null,
      notes_for_coach: c.notesForCoach || '',
      private_notes: c.privateNotes || '',
      is_followup: c.isFollowup || false,
      followup_data: c.followupData || null,
      previous_consultation_id: c.previousConsultationId || null,
      mgd_recommendation: c.mgdRecommendation || 'none',
      status: c.status || 'questionnaire_recu',
      label: c.label || null,
      created_at: c.createdAt || new Date().toISOString(),
    };
    const { error } = await supabase.from('nutrition_consultations').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error('Sync failed:', c.id, error.message);
      errors++;
    } else {
      synced++;
    }
  }
  return { synced, errors };
}

// ─── Full cloud pull (on login / app start) ───

export async function pullFromCloud() {
  if (!isCloudEnabled) return { synced: false };

  try {
    const [clientsRes, gensRes, sessionsRes, progRes, nutritionRes] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('generations').select('*'),
      supabase.from('massage_sessions').select('*'),
      supabase.from('progression').select('*'),
      supabase.from('nutrition_consultations').select('*').then(r => r).catch(() => ({ data: [], error: null })),
    ]);

    if (clientsRes.error) throw clientsRes.error;

    const cloudClients = clientsRes.data || [];
    const cloudGens = gensRes.data || [];
    const cloudSessions = sessionsRes.data || [];
    const cloudProg = progRes.data || [];
    const cloudNutrition = nutritionRes.data || [];

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

    // Store nutrition consultations locally
    const localNutrition = cloudNutrition.map(n => ({
      id: n.id,
      clientId: n.client_id,
      consultantName: n.consultant_name || 'Anissa',
      date: n.date,
      observations: n.observations || '',
      bloodTestDone: n.blood_test_done || false,
      dnaTestDone: n.dna_test_done || false,
      nutritionalObservations: n.nutritional_observations || '',
      nutritionPlan: n.nutrition_plan || '',
      supplements: n.supplements || '',
      recipes: n.recipes || '',
      ficheFrigoJson: n.fiche_frigo_json || null,
      labResults: n.lab_results || {},
      notesForCoach: n.notes_for_coach || '',
      privateNotes: n.private_notes || '',
      isFollowup: n.is_followup || false,
      followupData: n.followup_data || null,
      previousConsultationId: n.previous_consultation_id || null,
      mgdRecommendation: n.mgd_recommendation || 'none',
      status: n.status || 'questionnaire_recu',
      createdAt: n.created_at,
    }));
    // Merge with existing local nutrition consultations
    const existingNutrition = readNutritionConsultations();
    const nutritionMap = {};
    // Partir du cloud
    for (const n of localNutrition) nutritionMap[n.id] = n;
    // Merger avec le local : garder le plus récent par createdAt
    for (const n of existingNutrition) {
      if (!nutritionMap[n.id]) {
        nutritionMap[n.id] = n;
      } else {
        const cloudDate = new Date(nutritionMap[n.id].createdAt || 0);
        const localDate = new Date(n.createdAt || 0);
        if (localDate > cloudDate) {
          nutritionMap[n.id] = n;
        }
      }
    }
    writeNutritionConsultations(Object.values(nutritionMap));

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
        interviewNotes: c.interview_notes || null,
        createdBy: c.created_by || 'benoit',
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
    const deletedIds = readDeletedIds();

    // All cloud clients (skip tombstoned IDs — intentionally deleted)
    for (const [id, cloudClient] of Object.entries(cloudMap)) {
      if (deletedIds.has(id)) continue;
      const local = localMap[id];
      if (!local) {
        merged[id] = cloudClient;
      } else {
        // Keep the newer one
        const cloudDate = new Date(cloudClient.updatedAt || 0);
        const localDate = new Date(local.updatedAt || 0);
        if (cloudDate >= localDate) {
          merged[id] = {
            ...cloudClient,
            history: mergeArraysById(cloudClient.history, local.history),
            progression: mergeArraysById(cloudClient.progression, local.progression),
            massageSessions: mergeArraysById(cloudClient.massageSessions, local.massageSessions),
          };
        } else {
          merged[id] = {
            ...local,
            history: mergeArraysById(local.history, cloudClient.history),
            progression: mergeArraysById(local.progression, cloudClient.progression),
            massageSessions: mergeArraysById(local.massageSessions, cloudClient.massageSessions),
          };
        }
      }
    }

    // Local-only clients (not in cloud) — skip tombstoned
    for (const [id, local] of Object.entries(localMap)) {
      if (!cloudMap[id] && !deletedIds.has(id)) {
        merged[id] = local;
      }
    }

    const mergedList = Object.values(merged);
    writeAll(mergedList);

    // Push local-only data to cloud (skip tombstoned)
    for (const client of mergedList) {
      if (!cloudMap[client.id] && !deletedIds.has(client.id)) {
        cloudSyncClient(client);
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

    // Push local-only nutrition consultations to cloud
    const cloudNutritionIds = new Set(cloudNutrition.map(n => n.id));
    for (const n of Object.values(nutritionMap)) {
      if (!cloudNutritionIds.has(n.id)) {
        cloudSyncNutritionConsultation(n);
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
        ({ error } = await supabase.from('clients').upsert(op.data, { onConflict: 'id' }));
        break;
      case 'delete_client':
        ({ error } = await supabase.from('clients').delete().eq('id', op.data.id));
        if (!error) addDeletedId(op.data.id);
        break;
      case 'upsert_generation':
        ({ error } = await supabase.from('generations').upsert(op.data, { onConflict: 'id' }));
        break;
      case 'upsert_progression':
        ({ error } = await supabase.from('progression').upsert(op.data, { onConflict: 'id' }));
        break;
      case 'delete_progression':
        ({ error } = await supabase.from('progression').delete().eq('id', op.data.id));
        break;
      case 'upsert_massage_session':
        ({ error } = await supabase.from('massage_sessions').upsert(op.data, { onConflict: 'id' }));
        break;
      case 'delete_massage_session':
        ({ error } = await supabase.from('massage_sessions').delete().eq('id', op.data.id));
        break;
      case 'upsert_nutrition_consultation':
        ({ error } = await supabase.from('nutrition_consultations').upsert(op.data, { onConflict: 'id' }));
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

// Get clients shared with Anissa (Suivi Complet or Intensif formulas, created by Benoit)
export function getSharedClients() {
  return getClients().filter(c => {
    const formule = c.formule || '';
    return (formule === 'suivi' || formule === 'intensif') && (c.createdBy || 'benoit') !== 'anissa';
  });
}

// Get clients created by Anissa
export function getAnissaOwnClients() {
  return getClients().filter(c => c.createdBy === 'anissa');
}

// Get clients visible to Benoit (all except Anissa's own clients)
export function getBenoitClients() {
  return getClients().filter(c => (c.createdBy || 'benoit') !== 'anissa');
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
  addDeletedId(id);
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

export function updateInterviewNotes(clientId, interviewNotes) {
  const clients = readAll();
  const client = clients.find(c => c.id === clientId);
  if (!client) return null;
  client.interviewNotes = interviewNotes;
  client.updatedAt = new Date().toISOString();
  writeAll(clients);
  cloudSyncClient(client);
  return client;
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

// ─── Nutrition Consultations ───

export function getNutritionConsultations(clientId) {
  return readNutritionConsultations()
    .filter(n => n.clientId === clientId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function saveNutritionConsultation(consultation) {
  const consultations = readNutritionConsultations();
  const entry = {
    id: consultation.id || crypto.randomUUID(),
    clientId: consultation.clientId,
    consultantName: consultation.consultantName || 'Anissa',
    date: consultation.date || new Date().toISOString(),
    observations: consultation.observations || '',
    bloodTestDone: consultation.bloodTestDone || false,
    dnaTestDone: consultation.dnaTestDone || false,
    nutritionalObservations: consultation.nutritionalObservations || '',
    nutritionPlan: consultation.nutritionPlan || '',
    supplements: consultation.supplements || '',
    recipes: consultation.recipes || '',
    notesForCoach: consultation.notesForCoach || '',
    privateNotes: consultation.privateNotes || '',
    ficheFrigoJson: consultation.ficheFrigoJson || null,
    labResults: consultation.labResults || {},
    isFollowup: consultation.isFollowup || false,
    followupData: consultation.followupData || null,
    previousConsultationId: consultation.previousConsultationId || null,
    mgdRecommendation: consultation.mgdRecommendation || 'none',
    status: consultation.status || 'questionnaire_recu',
    createdAt: consultation.createdAt || new Date().toISOString(),
  };
  const idx = consultations.findIndex(c => c.id === entry.id);
  if (idx >= 0) {
    consultations[idx] = entry;
  } else {
    consultations.push(entry);
  }
  writeNutritionConsultations(consultations);
  cloudSyncNutritionConsultation(entry);
  return entry;
}

// ─── Client reminder frequency (localStorage, default 3 months) ───

const REMINDER_FREQ_KEY = 'bfc_reminder_frequencies';
export const DEFAULT_REMINDER_MONTHS = 3;

function readReminderFrequencies() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_FREQ_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeReminderFrequencies(data) {
  localStorage.setItem(REMINDER_FREQ_KEY, JSON.stringify(data));
}

export function setClientReminderFrequency(clientId, months) {
  if (!clientId) return;
  const data = readReminderFrequencies();
  const n = Number(months);
  if (!Number.isFinite(n) || n <= 0) {
    delete data[clientId];
  } else {
    data[clientId] = n;
  }
  writeReminderFrequencies(data);
}

export function getClientReminderFrequency(clientId) {
  if (!clientId) return DEFAULT_REMINDER_MONTHS;
  const data = readReminderFrequencies();
  const n = Number(data[clientId]);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REMINDER_MONTHS;
}

// ─── Plan versioning (localStorage only, max 3 versions per client) ───

const PLAN_VERSIONS_KEY = 'bfc_plan_versions';
const MAX_PLAN_VERSIONS = 3;

function readPlanVersions() {
  try {
    return JSON.parse(localStorage.getItem(PLAN_VERSIONS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writePlanVersions(data) {
  localStorage.setItem(PLAN_VERSIONS_KEY, JSON.stringify(data));
}

export function savePlanVersion(clientId, version) {
  if (!clientId || !version) return;
  const all = readPlanVersions();
  const list = Array.isArray(all[clientId]) ? all[clientId] : [];
  const entry = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    nutritionPlan: version.nutritionPlan || '',
    supplements: version.supplements || '',
    recipes: version.recipes || '',
    ficheFrigoJson: version.ficheFrigoJson || null,
    label: version.label || '',
  };
  list.unshift(entry);
  all[clientId] = list.slice(0, MAX_PLAN_VERSIONS);
  writePlanVersions(all);
  return entry;
}

export function getPlanVersions(clientId) {
  if (!clientId) return [];
  const all = readPlanVersions();
  return Array.isArray(all[clientId]) ? all[clientId] : [];
}

export function deletePlanVersion(clientId, versionId) {
  if (!clientId || !versionId) return;
  const all = readPlanVersions();
  if (!Array.isArray(all[clientId])) return;
  all[clientId] = all[clientId].filter(v => v.id !== versionId);
  writePlanVersions(all);
}

// Export/Import
export function exportAllData() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    clients: readAll(),
    nutritionConsultations: readNutritionConsultations(),
    apiKey: localStorage.getItem('bfc_api_key') || '',
  }, null, 2);
}

export function importAllData(jsonString) {
  const data = JSON.parse(jsonString);
  if (!data.clients || !Array.isArray(data.clients)) {
    throw new Error('Format invalide: pas de tableau clients');
  }
  writeAll(data.clients);
  if (data.nutritionConsultations) {
    writeNutritionConsultations(data.nutritionConsultations);
  }
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
    if (data.nutritionConsultations) {
      for (const n of data.nutritionConsultations) cloudSyncNutritionConsultation(n);
    }
  }
  return data.clients.length;
}


// ─── Notifications (localStorage + optional Supabase) ───

function readNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]'); }
  catch { return []; }
}

function writeNotifications(list) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
}

export function getNotifications() {
  return readNotifications().sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getUnreadNotificationCount() {
  return readNotifications().filter(n => !n.read).length;
}

export async function addNotification({ type, clientId, clientName, message }) {
  const list = readNotifications();
  const notif = {
    id: crypto.randomUUID(),
    type: type || 'info',
    clientId: clientId || null,
    clientName: clientName || '',
    message: message || '',
    date: new Date().toISOString(),
    read: false,
  };
  list.push(notif);
  writeNotifications(list);
  // Sync to Supabase if available
  if (isCloudEnabled) {
    const ownerId = await getCurrentOwnerId();
    supabase.from('notifications').upsert({ ...notif, owner_id: ownerId }).then(({ error }) => {
      if (error) console.warn('Notification sync failed:', error.message);
    });
  }
  return notif;
}

export function markNotificationRead(id) {
  const list = readNotifications();
  const notif = list.find(n => n.id === id);
  if (notif) {
    notif.read = true;
    writeNotifications(list);
    if (isCloudEnabled) {
      supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {});
    }
  }
}

export function markAllNotificationsRead() {
  const list = readNotifications().map(n => ({ ...n, read: true }));
  writeNotifications(list);
}

export function syncReminderNotifications(clients) {
  const list = readNotifications();
  // Preserve read state of existing reminders before regenerating
  const readState = {};
  for (const n of list) {
    if (n.type === 'consultation_reminder') readState[n.id] = n.read;
  }
  const cleaned = list.filter(n => n.type !== 'consultation_reminder');

  for (const c of clients) {
    const consultations = readNutritionConsultations().filter(n => n.clientId === c.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (consultations.length === 0) continue;
    const lastDate = consultations[0].date;
    const freqMonths = getClientReminderFrequency(c.id);
    const dueDate = new Date(lastDate);
    dueDate.setMonth(dueDate.getMonth() + freqMonths);
    const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 0) {
      const prenom = c.prenom || c.form?.prenom || 'Client';
      const severity = daysUntilDue <= -30 ? 'urgent' : 'overdue';
      const label = severity === 'urgent' ? 'Suivi urgent' : 'Suivi en retard';
      const reminderId = `reminder-${c.id}`;
      cleaned.push({
        id: reminderId,
        type: 'consultation_reminder',
        clientId: c.id,
        clientName: prenom,
        message: `${label} : ${prenom} (${Math.abs(daysUntilDue)}j de retard)`,
        date: dueDate.toISOString(),
        read: readState[reminderId] || false,
      });
    }
  }

  writeNotifications(cleaned);
}

// ─── Draft persistence for nutrition consultations ───

const DRAFT_KEY_PREFIX = 'bfc_draft_';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export function getDraftKey(clientId, consultationId) {
  return `${DRAFT_KEY_PREFIX}${clientId}_${consultationId || 'new'}`;
}

export function saveDraft(clientId, consultationId, { plan, supplements, recipes }) {
  if (!clientId) return;
  const key = getDraftKey(clientId, consultationId);
  const entry = {
    plan: plan || '',
    supplements: supplements || '',
    recipes: recipes || '',
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn('[DRAFT] localStorage full:', e.message);
  }
}

export function loadDraft(clientId, consultationId) {
  if (!clientId) return null;
  try {
    const raw = localStorage.getItem(getDraftKey(clientId, consultationId));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    // TTL : ignorer les drafts de plus de 7 jours
    if (!entry.savedAt || Date.now() - entry.savedAt > DRAFT_TTL_MS) {
      clearDraft(clientId, consultationId);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function clearDraft(clientId, consultationId) {
  if (!clientId) return;
  localStorage.removeItem(getDraftKey(clientId, consultationId));
}

// Nettoyage global des drafts expirés (appeler au boot)
export function purgeExpiredDrafts() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(DRAFT_KEY_PREFIX));
  for (const key of keys) {
    try {
      const entry = JSON.parse(localStorage.getItem(key) || '{}');
      if (!entry.savedAt || Date.now() - entry.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

// ─── Cycle Reviews ───

export async function createCycleReview(clientId, consultationId, ownerId) {
  if (!isCloudEnabled) return null;
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('cycle_reviews')
    .insert({
      token,
      client_id: clientId,
      consultation_id: consultationId || null,
      owner_id: ownerId,
      status: 'sent',
    })
    .select('token')
    .single();
  if (error) {
    console.warn('createCycleReview failed:', error.message);
    return null;
  }
  return data.token;
}

export async function getCycleReviews(clientId) {
  if (!isCloudEnabled) return [];
  const { data, error } = await supabase
    .from('cycle_reviews')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}
