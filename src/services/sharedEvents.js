// V31 : service agenda partagé Benoit <-> Anissa
// Table Supabase `shared_events` avec RLS authenticated-only.
import { supabase, isCloudEnabled } from '../supabaseClient';

export const SHARED_EVENT_CATEGORIES = [
  { value: 'perso',    label: '🏡 Perso',    color: '#6ab6f0' },
  { value: 'famille',  label: '👨‍👩‍👧 Famille', color: '#c4a050' },
  { value: 'medical',  label: '🏥 Médical',  color: '#c43050' },
  { value: 'pro',      label: '💼 Pro',      color: '#2e8b57' },
  { value: 'autre',    label: '📌 Autre',    color: 'rgba(212,201,168,0.65)' },
];

export function getCategoryMeta(value) {
  return SHARED_EVENT_CATEGORIES.find(c => c.value === value) || SHARED_EVENT_CATEGORIES[SHARED_EVENT_CATEGORIES.length - 1];
}

// Liste les événements dans une plage [fromIso, toIso]
export async function listSharedEvents(fromIso, toIso) {
  if (!isCloudEnabled) return { data: [], error: null };
  let q = supabase.from('shared_events').select('*').order('start_at', { ascending: true });
  if (fromIso) q = q.gte('start_at', fromIso);
  if (toIso)   q = q.lte('start_at', toIso);
  const { data, error } = await q;
  return { data: data || [], error };
}

// Crée un événement
export async function createSharedEvent(event, currentUser) {
  if (!isCloudEnabled) return { data: null, error: new Error('Supabase non configuré') };
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    title: event.title,
    description: event.description || null,
    start_at: event.start_at,
    end_at: event.end_at || null,
    all_day: !!event.all_day,
    category: event.category || 'perso',
    location: event.location || null,
    created_by: currentUser || null,
    owner_id: user?.id || null,
    // V32 : client lié (optionnel)
    client_id: event.client_id || null,
    client_name: event.client_name || null,
    client_source: event.client_source || null, // 'benoit' | 'anissa' | 'shared'
  };
  const { data, error } = await supabase.from('shared_events').insert(payload).select().single();
  return { data, error };
}

// Met à jour un événement
export async function updateSharedEvent(id, patch) {
  if (!isCloudEnabled) return { data: null, error: new Error('Supabase non configuré') };
  const { data, error } = await supabase.from('shared_events').update(patch).eq('id', id).select().single();
  return { data, error };
}

// Supprime un événement
export async function deleteSharedEvent(id) {
  if (!isCloudEnabled) return { error: new Error('Supabase non configuré') };
  const { error } = await supabase.from('shared_events').delete().eq('id', id);
  return { error };
}

// V37/V39 : helper partagé — calcule les rappels agenda depuis une liste d'événements
// Utilisé par Dashboard (cloche Benoit) et App.jsx (cloche Anissa)
export function buildAgendaAlerts(events) {
  const out = [];
  if (!Array.isArray(events) || events.length === 0) return out;
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const endOfTomorrow = new Date(startOfTomorrow); endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const sorted = [...events]
    .filter(e => e?.start_at)
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

  // A. RDV dans < 60 min
  const soon = sorted.find(e => {
    const s = new Date(e.start_at);
    return s.getTime() >= now.getTime() && s.getTime() <= oneHourLater.getTime();
  });
  if (soon) {
    const s = new Date(soon.start_at);
    const diffMin = Math.max(0, Math.round((s.getTime() - now.getTime()) / 60000));
    const label = diffMin <= 1 ? 'maintenant' : `dans ${diffMin} min`;
    out.push({
      priority: 10,
      type: 'agenda_rdv_soon',
      eventId: soon.id,
      clientId: soon.client_id || null,
      clientName: soon.title || 'RDV',
      message: `⏰ ${soon.title || 'RDV'} ${label}`,
    });
  }

  // B. Premier RDV demain
  const tomorrowEvents = sorted.filter(e => {
    const s = new Date(e.start_at);
    return s.getTime() >= startOfTomorrow.getTime() && s.getTime() < endOfTomorrow.getTime();
  });
  if (tomorrowEvents.length > 0) {
    const first = tomorrowEvents[0];
    const hh = new Date(first.start_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
    out.push({
      priority: 11,
      type: 'agenda_tomorrow_first',
      eventId: first.id,
      clientId: first.client_id || null,
      clientName: first.title || 'RDV',
      message: `📅 Demain ${hh} — ${first.title || 'RDV'}`,
    });
  }

  // C. Journée chargée
  const todayEvents = sorted.filter(e => {
    const s = new Date(e.start_at);
    return s.getTime() >= startOfToday.getTime() && s.getTime() < startOfTomorrow.getTime();
  });
  if (todayEvents.length >= 4) {
    out.push({
      priority: 12,
      type: 'agenda_busy_day',
      eventId: null,
      clientName: "Aujourd'hui",
      message: `📚 Journée chargée aujourd'hui (${todayEvents.length} RDV)`,
    });
  } else if (tomorrowEvents.length >= 4) {
    out.push({
      priority: 12,
      type: 'agenda_busy_day',
      eventId: null,
      clientName: 'Demain',
      message: `📚 Journée chargée demain (${tomorrowEvents.length} RDV)`,
    });
  }

  return out;
}
