// V31 : Agenda partagé Benoit <-> Anissa (vie perso + famille + pro + médical)
// V32 : recherche client + filtre période + liaison visuelle
// Lecture/écriture directe dans Supabase (table shared_events).
import { useEffect, useMemo, useState } from 'react';
import {
  SHARED_EVENT_CATEGORIES,
  getCategoryMeta,
  listSharedEvents,
  createSharedEvent,
  updateSharedEvent,
  deleteSharedEvent,
} from './services/sharedEvents';
import { isCloudEnabled } from './supabaseClient';
import { getClients } from './store';

function toIsoLocal(date) {
  // Retourne YYYY-MM-DDTHH:mm formaté localement (utilisé pour <input type="datetime-local">)
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function formatEventDate(iso, allDay) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const opts = allDay
    ? { weekday: 'short', day: '2-digit', month: 'short' }
    : { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleDateString('fr-CH', opts);
}
function dayKey(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Retourne la source d'un client : 'benoit' | 'anissa' | 'shared'
function getClientSource(c) {
  const createdBy = (c?.createdBy || 'benoit').toLowerCase();
  const formule = (c?.formule || '').toLowerCase();
  if (createdBy === 'anissa') return 'anissa';
  if (formule === 'suivi' || formule === 'intensif') return 'shared';
  return 'benoit';
}
const SOURCE_BADGE = {
  benoit: { label: 'Benoit', color: '#c4a050', bg: 'rgba(196,160,80,0.15)' },
  anissa: { label: 'Anissa', color: '#6abf8a', bg: 'rgba(106,191,138,0.15)' },
  shared: { label: 'Partagé', color: '#6ab6f0', bg: 'rgba(106,182,240,0.15)' },
};

export default function SharedCalendar({ currentUser, onBack, onOpenClient }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state (ajout + édition)
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('perso');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  // V32 : liaison client
  const [clientId, setClientId] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientSource, setClientSource] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  // V34 : durée en minutes (calcule end_at auto)
  const [duration, setDuration] = useState(60);

  // Filtre catégorie (optionnel)
  const [filterCat, setFilterCat] = useState('all');
  // V32 : filtre période (today | 7d | all)
  const [filterRange, setFilterRange] = useState('all');
  // V36 : toggle vue (list | week)
  const [viewMode, setViewMode] = useState('list');

  // Liste des clients (tous, depuis le store localStorage — couvre Benoit/Anissa/partagés)
  const allClients = useMemo(() => getClients(), []);
  const clientResults = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return allClients
      .filter(c => (c.prenom || c.form?.prenom || '').toLowerCase().includes(q))
      .slice(0, 8)
      .map(c => ({
        id: c.id,
        name: c.prenom || c.form?.prenom || 'Sans nom',
        source: getClientSource(c),
      }));
  }, [clientSearch, allClients]);

  // Charge les 60 prochains jours
  const loadEvents = async () => {
    if (!isCloudEnabled) {
      setError('Supabase non configuré — agenda non disponible.');
      return;
    }
    setLoading(true);
    setError('');
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(); to.setDate(to.getDate() + 60);
    const { data, error: err } = await listSharedEvents(from.toISOString(), to.toISOString());
    if (err) setError(err.message || 'Erreur de chargement');
    else setEvents(data);
    setLoading(false);
  };

  useEffect(() => { loadEvents(); }, []);

  // V34 : auto-calcul de endAt = startAt + duration (si start valide et pas "toute la journée")
  useEffect(() => {
    if (allDay || !startAt) return;
    const parsed = new Date(fromLocalInput(startAt));
    if (!parsed || isNaN(parsed.getTime())) return;
    const end = new Date(parsed);
    end.setMinutes(end.getMinutes() + (duration || 60));
    setEndAt(toIsoLocal(end));
  }, [startAt, duration, allDay]);

  const filteredEvents = useMemo(() => {
    let out = events;
    if (filterCat !== 'all') out = out.filter(e => e.category === filterCat);
    if (filterRange !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
      let cutoff;
      if (filterRange === 'today') {
        const end = new Date(startOfToday); end.setDate(end.getDate() + 1);
        cutoff = end;
        out = out.filter(e => {
          const d = new Date(e.start_at);
          return d >= startOfToday && d < cutoff;
        });
      } else if (filterRange === '7d') {
        const end = new Date(startOfToday); end.setDate(end.getDate() + 7);
        cutoff = end;
        out = out.filter(e => {
          const d = new Date(e.start_at);
          return d >= startOfToday && d < cutoff;
        });
      }
    }
    return out;
  }, [events, filterCat, filterRange]);

  // Regroupement par jour
  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const e of filteredEvents) {
      const k = dayKey(e.start_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return map;
  }, [filteredEvents]);

  const sortedDays = useMemo(() => [...eventsByDay.keys()].sort(), [eventsByDay]);

  // V33 : templates rapides — pré-remplit le formulaire, ne crée pas l'événement
  const EVENT_TEMPLATES = [
    { key: 'coaching',  label: '+ Coaching',  baseTitle: 'Coaching',                category: 'pro',     duration: 60 },
    { key: 'nutrition', label: '+ Nutrition', baseTitle: 'Consultation nutrition',  category: 'pro',     duration: 60 },
    { key: 'masso',     label: '+ Masso',     baseTitle: 'Massothérapie',           category: 'pro',     duration: 60 },
    { key: 'perso',     label: '+ Perso',     baseTitle: '',                        category: 'perso',   duration: 60 },
    { key: 'famille',   label: '+ Famille',   baseTitle: '',                        category: 'famille', duration: 60 },
  ];

  const applyTemplate = (tpl) => {
    setCategory(tpl.category);
    // Titre : base + nom du client s'il est déjà sélectionné
    let nextTitle = tpl.baseTitle || '';
    if (tpl.baseTitle && clientName) {
      nextTitle = `${tpl.baseTitle} ${clientName}`;
    }
    setTitle(nextTitle);
    // V34 : set durée (endAt sera calculé via useEffect)
    setDuration(tpl.duration || 60);
    // Pré-remplir start si vide (sinon respecter choix manuel)
    const parsedStart = startAt ? new Date(fromLocalInput(startAt)) : null;
    const startInvalid = !parsedStart || isNaN(parsedStart?.getTime?.());
    if (startInvalid) {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      setStartAt(toIsoLocal(now));
    }
    setAllDay(false);
    setFormError('');
    if (!formOpen) setFormOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle(''); setCategory('perso'); setStartAt(''); setEndAt('');
    setAllDay(false); setLocation(''); setDescription(''); setFormError('');
    setFormOpen(false);
    setClientId(null); setClientName(''); setClientSource(null);
    setClientSearch(''); setClientSearchOpen(false);
    setDuration(60);
  };

  const openCreate = () => {
    resetForm();
    // Pré-remplit avec "dans 1h" par défaut
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    setStartAt(toIsoLocal(now));
    setFormOpen(true);
  };

  const openEdit = (ev) => {
    setEditingId(ev.id);
    setTitle(ev.title || '');
    setCategory(ev.category || 'perso');
    setStartAt(toIsoLocal(ev.start_at));
    setEndAt(ev.end_at ? toIsoLocal(ev.end_at) : '');
    setAllDay(!!ev.all_day);
    // V34 : recalc durée à partir de l'événement existant (si fin dispo)
    if (ev.start_at && ev.end_at) {
      const diffMin = Math.round((new Date(ev.end_at).getTime() - new Date(ev.start_at).getTime()) / 60000);
      setDuration(diffMin > 0 ? diffMin : 60);
    } else {
      setDuration(60);
    }
    setLocation(ev.location || '');
    setDescription(ev.description || '');
    setClientId(ev.client_id || null);
    setClientName(ev.client_name || '');
    setClientSource(ev.client_source || null);
    setClientSearch('');
    setClientSearchOpen(false);
    setFormError('');
    setFormOpen(true);
  };

  const handlePickClient = (c) => {
    setClientId(c.id);
    setClientName(c.name);
    setClientSource(c.source);
    setClientSearch('');
    setClientSearchOpen(false);
  };
  const handleUnlinkClient = () => {
    setClientId(null);
    setClientName('');
    setClientSource(null);
  };

  const handleSave = async () => {
    setFormError('');
    if (!title.trim()) { setFormError('Titre requis'); return; }
    if (!startAt) { setFormError('Date de début requise'); return; }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      start_at: fromLocalInput(startAt),
      end_at: endAt ? fromLocalInput(endAt) : null,
      all_day: allDay,
      category,
      location: location.trim() || null,
      client_id: clientId || null,
      client_name: clientName || null,
      client_source: clientSource || null,
    };
    if (editingId) {
      const { error: err } = await updateSharedEvent(editingId, payload);
      if (err) { setFormError(err.message || 'Erreur'); return; }
    } else {
      const { error: err } = await createSharedEvent(payload, currentUser);
      if (err) { setFormError(err.message || 'Erreur'); return; }
    }
    resetForm();
    loadEvents();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet événement ?')) return;
    const { error: err } = await deleteSharedEvent(id);
    if (err) { alert(err.message); return; }
    loadEvents();
  };

  return (
    <div className="shared-calendar" style={{ padding: '16px 12px', maxWidth: 720, margin: '0 auto' }}>
      <style>{`
        .sc-hdr { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .sc-hdr h2 { margin:0; flex:1; color:var(--text); font-size:1.1em; }
        .sc-btn {
          min-height:44px; padding:10px 14px; border-radius:10px;
          background: #c4a050; border:1px solid #c4a050; color:#1e1b16;
          font-weight:700; cursor:pointer; font-size:.9em;
        }
        .sc-btn-ghost {
          background: transparent; border:1px solid rgba(196,160,80,0.3);
          color: #c4a050; font-weight: 600;
        }
        .sc-filters { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
        .sc-filter-pill {
          min-height: 36px; padding: 6px 12px; border-radius: 18px;
          background: rgba(196,160,80,.06); border: 1px solid rgba(196,160,80,.2);
          color: var(--text); font-size: .82em; cursor: pointer;
        }
        .sc-filter-pill.active {
          background: rgba(196,160,80,.18); border-color: #c4a050; color: #c4a050; font-weight: 600;
        }
        .sc-day-block { margin-bottom: 14px; }
        .sc-day-title {
          font-size:.8em; color: #c4a050; font-weight:700;
          text-transform: uppercase; letter-spacing: .06em;
          padding: 4px 0 6px; border-bottom: 1px solid rgba(196,160,80,.15);
          margin-bottom: 6px;
        }
        .sc-ev {
          display:flex; gap:10px; align-items:center;
          padding: 10px 12px; border-radius: 10px;
          background: rgba(0,0,0,.2); border: 1px solid rgba(196,160,80,.12);
          margin-top: 4px;
        }
        .sc-ev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .sc-ev-body { flex:1; min-width:0; }
        .sc-ev-title { font-weight:600; color:var(--text); font-size:.92em; }
        .sc-ev-meta { font-size:.75em; color: var(--text-muted); margin-top: 2px; }
        .sc-ev-actions { display:flex; gap:4px; }
        .sc-ev-actions button { min-height: 32px; padding: 4px 8px; border-radius: 6px; cursor: pointer; border: none; background: transparent; color: var(--text-muted); }
        .sc-ev-actions button:hover { background: rgba(196,160,80,.1); }
        .sc-form { margin-top: 14px; padding: 16px; border-radius: 12px;
          background: rgba(196,160,80,.06); border: 1px solid rgba(196,160,80,.25);
          display: flex; flex-direction: column; gap: 10px;
        }
        .sc-input {
          min-height: 44px; padding: 10px 12px; border-radius: 8px;
          border: 1px solid rgba(196,160,80,.3); background: rgba(0,0,0,.25);
          color: var(--text); font-size: .95em; width: 100%;
        }
        .sc-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .sc-row > * { flex: 1; min-width: 140px; }
        .sc-cat-pills { display:flex; gap:6px; flex-wrap:wrap; }
        .sc-cat-pill {
          min-height: 40px; padding: 8px 12px; border-radius: 8px;
          border: 1px solid rgba(196,160,80,.2); background: rgba(196,160,80,.05);
          color: var(--text); cursor: pointer; font-size: .88em;
        }
        .sc-cat-pill.active {
          background: rgba(196,160,80,.2); border-color: #c4a050; color: #c4a050; font-weight: 600;
        }
      `}</style>

      <div className="sc-hdr">
        {onBack && (
          <button type="button" onClick={onBack} className="sc-btn sc-btn-ghost" style={{ padding: '8px 12px' }}>← Retour</button>
        )}
        <h2>📅 Agenda partagé</h2>
        {!formOpen && (
          <button type="button" className="sc-btn" onClick={openCreate}>+ Événement</button>
        )}
      </div>

      {formOpen && (
        <div className="sc-form">
          <div style={{ fontSize: '.9em', color: '#c4a050', fontWeight: 600 }}>
            {editingId ? '✏️ Modifier' : '➕ Nouvel événement'}
          </div>
          {/* V33 : templates rapides (scroll horizontal sur mobile si besoin) */}
          {!editingId && (
            <div
              className="sc-templates"
              style={{
                display: 'flex', gap: 8, overflowX: 'auto',
                paddingBottom: 4, marginBottom: 4,
                scrollbarWidth: 'thin',
              }}
            >
              {EVENT_TEMPLATES.map(tpl => (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    flexShrink: 0,
                    minHeight: 44, padding: '8px 14px',
                    borderRadius: 22,
                    background: 'rgba(196,160,80,0.1)',
                    border: '1px solid rgba(196,160,80,0.3)',
                    color: '#c4a050',
                    fontSize: '.85em', fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Template : ${tpl.label}`}
                >{tpl.label}</button>
              ))}
            </div>
          )}
          <input
            className="sc-input" type="text" placeholder="Titre *"
            value={title} onChange={e => setTitle(e.target.value)}
          />
          <div className="sc-cat-pills">
            {SHARED_EVENT_CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                className={`sc-cat-pill ${category === c.value ? 'active' : ''}`}
                onClick={() => setCategory(c.value)}
                style={category === c.value ? { color: c.color, borderColor: c.color } : {}}
              >{c.label}</button>
            ))}
          </div>
          {/* V34 : saisie simplifiée — date + heure début séparés, créneaux + durées rapides, fin auto */}
          {allDay ? (
            <input
              className="sc-input" type="date"
              value={startAt ? startAt.slice(0, 10) : ''}
              onChange={e => setStartAt(e.target.value ? `${e.target.value}T00:00` : '')}
              placeholder="Date"
            />
          ) : (
            <div className="sc-row">
              <input
                className="sc-input" type="date"
                value={startAt ? startAt.slice(0, 10) : ''}
                onChange={e => {
                  const date = e.target.value;
                  const time = startAt ? startAt.slice(11, 16) : '09:00';
                  setStartAt(date ? `${date}T${time}` : '');
                }}
                style={{ flex: 1 }}
              />
              <input
                className="sc-input" type="time"
                value={startAt ? startAt.slice(11, 16) : ''}
                onChange={e => {
                  const time = e.target.value;
                  const date = startAt ? startAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                  setStartAt(time ? `${date}T${time}` : '');
                }}
                style={{ flex: 1 }}
              />
            </div>
          )}
          {/* V34/V35/V38 : Créneaux rapides — visibles uniquement en mode création + non allDay */}
          {!allDay && !editingId && (() => {
            // V38 : plage horaire étendue 06:00 → 22:00 (17 créneaux)
            const QUICK_SLOTS = Array.from({ length: 17 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`);
            const setSlot = (hhmm) => {
              // V35 : si date existe → conserver la date choisie ; sinon date du jour
              let date = startAt ? startAt.slice(0, 10) : null;
              if (!date) {
                const now = new Date();
                date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
              }
              setStartAt(`${date}T${hhmm}`);
            };
            const currentHHMM = startAt ? startAt.slice(11, 16) : '';
            return (
              <div style={{
                display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
                scrollbarWidth: 'thin',
              }}>
                {QUICK_SLOTS.map(s => {
                  const active = s === currentHHMM;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      style={{
                        flexShrink: 0, minHeight: 44, minWidth: 64,
                        padding: '8px 12px', borderRadius: 10,
                        background: active ? 'rgba(196,160,80,0.25)' : 'rgba(196,160,80,0.06)',
                        border: `1px solid ${active ? '#c4a050' : 'rgba(196,160,80,0.2)'}`,
                        color: active ? '#c4a050' : 'var(--text)',
                        fontWeight: active ? 700 : 500, fontSize: '.88em',
                        cursor: 'pointer',
                      }}
                    >{s}</button>
                  );
                })}
              </div>
            );
          })()}
          {/* Durées rapides */}
          {!allDay && (() => {
            const DURATIONS = [
              { v: 30, label: '30 min' },
              { v: 45, label: '45 min' },
              { v: 60, label: '1h' },
              { v: 90, label: '1h30' },
              { v: 120, label: '2h' },
            ];
            return (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.78em', color: 'var(--text-muted)', alignSelf: 'center', minWidth: 50 }}>Durée :</span>
                {DURATIONS.map(d => {
                  const active = duration === d.v;
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => setDuration(d.v)}
                      style={{
                        minHeight: 44, padding: '8px 14px', borderRadius: 22,
                        background: active ? 'rgba(196,160,80,0.25)' : 'rgba(196,160,80,0.06)',
                        border: `1px solid ${active ? '#c4a050' : 'rgba(196,160,80,0.2)'}`,
                        color: active ? '#c4a050' : 'var(--text)',
                        fontWeight: active ? 700 : 500, fontSize: '.85em',
                        cursor: 'pointer',
                      }}
                    >{d.label}</button>
                  );
                })}
              </div>
            );
          })()}
          {/* Fin affichée en lecture (calculée auto) */}
          {!allDay && endAt && (
            <div style={{
              fontSize: '.82em', color: 'var(--text-muted)',
              padding: '4px 2px',
            }}>
              → Fin : <strong style={{ color: '#c4a050' }}>
                {new Date(fromLocalInput(endAt)).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
              </strong>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9em', color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
            Toute la journée
          </label>
          <input
            className="sc-input" type="text" placeholder="Lieu (optionnel)"
            value={location} onChange={e => setLocation(e.target.value)}
          />
          {/* V32 : liaison client */}
          <div style={{ position: 'relative' }}>
            {clientId ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(106,182,240,0.08)',
                border: '1px solid rgba(106,182,240,0.3)',
              }}>
                <span style={{ flex: 1, fontSize: '.9em', color: 'var(--text)' }}>
                  👤 <strong>{clientName}</strong>
                  {clientSource && SOURCE_BADGE[clientSource] && (
                    <span style={{
                      marginLeft: 8, padding: '2px 8px', borderRadius: 10,
                      background: SOURCE_BADGE[clientSource].bg,
                      color: SOURCE_BADGE[clientSource].color,
                      fontSize: '.72em', fontWeight: 600,
                    }}>{SOURCE_BADGE[clientSource].label}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleUnlinkClient}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '.9em', padding: '4px 8px',
                  }}
                  title="Délier le client"
                >✕</button>
              </div>
            ) : (
              <>
                <input
                  className="sc-input" type="text"
                  placeholder="Lier à un client (recherche par prénom)…"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientSearchOpen(true); }}
                  onFocus={() => setClientSearchOpen(true)}
                />
                {clientSearchOpen && clientResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: '#1e1b16',
                    border: '1px solid rgba(196,160,80,0.3)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 50, maxHeight: 260, overflowY: 'auto',
                  }}>
                    {clientResults.map(c => {
                      const b = SOURCE_BADGE[c.source] || SOURCE_BADGE.benoit;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handlePickClient(c)}
                          style={{
                            width: '100%', textAlign: 'left',
                            padding: '10px 12px', minHeight: 44,
                            background: 'transparent', border: 'none',
                            borderBottom: '1px solid rgba(196,160,80,0.1)',
                            color: 'var(--text)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}
                        >
                          <span style={{ flex: 1, fontSize: '.9em' }}>{c.name}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10,
                            background: b.bg, color: b.color,
                            fontSize: '.7em', fontWeight: 600,
                          }}>{b.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <textarea
            className="sc-input" placeholder="Note / description (optionnel)"
            rows={3} value={description} onChange={e => setDescription(e.target.value)}
            style={{ resize: 'vertical', minHeight: 60 }}
          />
          {formError && <div style={{ color: '#c43050', fontSize: '.85em' }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="sc-btn sc-btn-ghost" onClick={resetForm} style={{ flex: 1 }}>Annuler</button>
            <button type="button" className="sc-btn" onClick={handleSave} style={{ flex: 2 }}>
              {editingId ? '✓ Enregistrer' : '+ Créer'}
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      {!formOpen && (
        <>
          {/* V36 : toggle vue (Liste / Semaine) */}
          <div className="sc-filters" style={{ marginTop: 14 }}>
            <button
              type="button"
              className={`sc-filter-pill ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ minWidth: 90 }}
            >📋 Liste</button>
            <button
              type="button"
              className={`sc-filter-pill ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
              style={{ minWidth: 90 }}
            >📅 Semaine</button>
          </div>
          {/* V32 : filtre période rapide (uniquement en mode liste — la semaine impose son range) */}
          {viewMode === 'list' && (
            <div className="sc-filters">
              <button type="button" className={`sc-filter-pill ${filterRange === 'today' ? 'active' : ''}`} onClick={() => setFilterRange('today')}>Aujourd'hui</button>
              <button type="button" className={`sc-filter-pill ${filterRange === '7d' ? 'active' : ''}`} onClick={() => setFilterRange('7d')}>7 jours</button>
              <button type="button" className={`sc-filter-pill ${filterRange === 'all' ? 'active' : ''}`} onClick={() => setFilterRange('all')}>Tout</button>
            </div>
          )}
          <div className="sc-filters">
            <button type="button" className={`sc-filter-pill ${filterCat === 'all' ? 'active' : ''}`} onClick={() => setFilterCat('all')}>Toutes</button>
            {SHARED_EVENT_CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                className={`sc-filter-pill ${filterCat === c.value ? 'active' : ''}`}
                onClick={() => setFilterCat(c.value)}
              >{c.label}</button>
            ))}
          </div>
        </>
      )}

      {error && <div style={{ color: '#c43050', padding: 12, textAlign: 'center' }}>{error}</div>}
      {loading && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>Chargement…</div>}

      {/* V36 : Vue Semaine — 7 jours à partir d'aujourd'hui, tous affichés même vides */}
      {viewMode === 'week' && !loading && (() => {
        // Base filtrée : on applique uniquement le filtre catégorie (pas le range, la semaine est son propre range)
        const weekEvents = filterCat === 'all'
          ? events
          : events.filter(e => e.category === filterCat);
        // Génère 7 jours consécutifs depuis aujourd'hui
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(today); d.setDate(d.getDate() + i);
          days.push(d);
        }
        // Regroupe par dayKey
        const evByDay = new Map();
        for (const ev of weekEvents) {
          const k = dayKey(ev.start_at);
          if (!evByDay.has(k)) evByDay.set(k, []);
          evByDay.get(k).push(ev);
        }
        // Tri par heure dans chaque jour
        for (const arr of evByDay.values()) {
          arr.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {days.map((d, idx) => {
              const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const dayEvents = evByDay.get(k) || [];
              let dayLabel;
              if (idx === 0) dayLabel = "Aujourd'hui";
              else if (idx === 1) dayLabel = 'Demain';
              else dayLabel = d.toLocaleDateString('fr-CH', { weekday: 'short', day: '2-digit', month: 'short' });
              const isToday = idx === 0;
              return (
                <div
                  key={k}
                  style={{
                    padding: 12, borderRadius: 12,
                    background: isToday ? 'rgba(196,160,80,0.08)' : 'rgba(0,0,0,0.15)',
                    border: `1px solid ${isToday ? 'rgba(196,160,80,0.3)' : 'rgba(196,160,80,0.1)'}`,
                  }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    marginBottom: dayEvents.length > 0 ? 10 : 0,
                  }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '.95em',
                      color: isToday ? '#c4a050' : 'var(--text)',
                      textTransform: 'capitalize',
                    }}>{dayLabel}</div>
                    {dayEvents.length > 0 && (
                      <div style={{
                        fontSize: '.72em', fontWeight: 600,
                        padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(196,160,80,0.15)',
                        color: '#c4a050',
                      }}>
                        {dayEvents.length} {dayEvents.length > 1 ? 'événements' : 'événement'}
                      </div>
                    )}
                  </div>
                  {dayEvents.length === 0 ? (
                    <div style={{ fontSize: '.78em', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                      Rien de prévu
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dayEvents.map(ev => {
                        const meta = getCategoryMeta(ev.category);
                        const hourStart = ev.all_day ? 'Toute la journée' : new Date(ev.start_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
                        const hourEnd = (ev.end_at && !ev.all_day) ? new Date(ev.end_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : null;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => openEdit(ev)}
                            style={{
                              textAlign: 'left', width: '100%',
                              padding: '10px 12px', minHeight: 52,
                              borderRadius: 8,
                              background: 'rgba(0,0,0,0.3)',
                              border: `1px solid ${meta.color}33`,
                              borderLeft: `3px solid ${meta.color}`,
                              color: 'var(--text)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 10,
                            }}
                          >
                            <span style={{
                              color: meta.color, fontWeight: 700,
                              fontSize: '.82em', minWidth: 82, fontVariantNumeric: 'tabular-nums',
                              flexShrink: 0,
                            }}>
                              {ev.all_day ? 'All day' : (hourEnd ? `${hourStart}–${hourEnd}` : hourStart)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontSize: '.88em', fontWeight: 600,
                                display: 'block',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{ev.title}</span>
                              <span style={{
                                fontSize: '.72em', color: 'var(--text-muted)',
                                display: 'block', marginTop: 1,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {meta.label}
                                {ev.client_name ? ` · 👤 ${ev.client_name}` : ''}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {!loading && sortedDays.length === 0 && !error && viewMode === 'list' && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          Aucun événement dans les 60 prochains jours.
        </div>
      )}

      {viewMode === 'list' && sortedDays.map(dk => {
        const d = new Date(dk + 'T00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        let dayLabel;
        if (d.getTime() === today.getTime()) dayLabel = "Aujourd'hui";
        else if (d.getTime() === tomorrow.getTime()) dayLabel = 'Demain';
        else dayLabel = d.toLocaleDateString('fr-CH', { weekday: 'long', day: '2-digit', month: 'long' });
        return (
          <div key={dk} className="sc-day-block">
            <div className="sc-day-title">{dayLabel}</div>
            {eventsByDay.get(dk).map(ev => {
              const meta = getCategoryMeta(ev.category);
              const hourStart = ev.all_day ? 'Toute la journée' : new Date(ev.start_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
              const hourEnd = (ev.end_at && !ev.all_day) ? new Date(ev.end_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : null;
              const srcBadge = ev.client_source && SOURCE_BADGE[ev.client_source];
              const canOpenClient = !!ev.client_id && typeof onOpenClient === 'function';
              return (
                <div key={ev.id} className="sc-ev">
                  <span className="sc-ev-dot" style={{ background: meta.color }} />
                  <div className="sc-ev-body">
                    <div className="sc-ev-title">
                      <span style={{ color: meta.color, fontWeight: 700, marginRight: 8 }}>
                        {hourStart}{hourEnd ? ` – ${hourEnd}` : ''}
                      </span>
                      {ev.title}
                    </div>
                    <div className="sc-ev-meta">
                      <span>{meta.label}</span>
                      {ev.location && <span> · 📍 {ev.location}</span>}
                    </div>
                    {ev.client_name && (
                      <div className="sc-ev-meta" style={{ marginTop: 4 }}>
                        👤{' '}
                        {canOpenClient ? (
                          <button
                            type="button"
                            onClick={() => onOpenClient(ev.client_id)}
                            style={{
                              background: 'transparent', border: 'none',
                              color: '#6ab6f0', textDecoration: 'underline',
                              cursor: 'pointer', padding: 0, fontSize: 'inherit',
                            }}
                          >{ev.client_name}</button>
                        ) : (
                          <span style={{ color: 'var(--text)' }}>{ev.client_name}</span>
                        )}
                        {srcBadge && (
                          <span style={{
                            marginLeft: 6, padding: '1px 6px', borderRadius: 8,
                            background: srcBadge.bg, color: srcBadge.color,
                            fontSize: '.75em', fontWeight: 600,
                          }}>{srcBadge.label}</span>
                        )}
                      </div>
                    )}
                    {ev.created_by && (
                      <div className="sc-ev-meta" style={{ marginTop: 2, fontSize: '.7em', opacity: 0.7 }}>
                        Créé par {ev.created_by}
                      </div>
                    )}
                  </div>
                  <div className="sc-ev-actions">
                    <button type="button" title="Modifier" onClick={() => openEdit(ev)}>✏️</button>
                    <button type="button" title="Supprimer" onClick={() => handleDelete(ev.id)}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
