// ─── PhaseRecommendationsPanel.jsx ──────────────────────────────────────
// V97.22 — Cockpit UI Anissa pour editer les recommandations par phase.
//
// Cf chantier : V97.18 hybride templates par phase (Phase A + B).
// Cf service : services/phaseTemplatesService.js
// Cf table : phase_recommendations (V97.22 + V97.22.1 seed).
//
// Modal avec liste des phases groupees par template_key. Pour chaque phase :
//   - Toggle enabled
//   - Edit client_name + clinical_name
//   - TagEditor pour foods_favor, foods_limit, cooking, cooking_avoid
//   - SupplementsEditor (jsonb : name + dose + timing)
//   - Textarea clinical_notes
//
// Sauvegarde individuelle par phase. Audit log auto via service.

import { useState, useEffect } from 'react';
import { listPhaseRecommendations, updatePhaseRecommendation, listPhaseRecoAuditLog } from '../services/phaseTemplatesService';

export default function PhaseRecommendationsPanel({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [tab, setTab] = useState('matrix');
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await listPhaseRecommendations();
      if (!alive) return;
      if (res.ok) {
        setRows(res.data);
        setError(null);
      } else {
        setError(res.error || 'erreur chargement');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (tab !== 'history') return;
    let alive = true;
    (async () => {
      setAuditLoading(true);
      const res = await listPhaseRecoAuditLog(20);
      if (!alive) return;
      if (res.ok) setAuditEntries(res.data);
      setAuditLoading(false);
    })();
    return () => { alive = false; };
  }, [tab]);

  const handleSave = async (id, patch, beforeState) => {
    const res = await updatePhaseRecommendation(id, patch, beforeState);
    if (res.ok) {
      const refresh = await listPhaseRecommendations();
      if (refresh.ok) setRows(refresh.data);
    }
    return res;
  };

  // Group by template_key
  const grouped = rows.reduce((acc, r) => {
    if (!acc[r.template_key]) acc[r.template_key] = [];
    acc[r.template_key].push(r);
    return acc;
  }, {});

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Recommandations par phase
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b6f6b' }}>
              Templates clinique des phases du parcours (aliments à privilégier/limiter, cuissons,
              compléments, notes). Servira à l&apos;auto-application aux transitions de phase (V97.18+).
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle} title="Fermer">×</button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
          <TabButton active={tab === 'matrix'} onClick={() => setTab('matrix')}>
            Matrice ({rows.length})
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            Historique
          </TabButton>
        </div>

        <div style={bodyStyle}>
          {tab === 'matrix' && (
            <>
              {loading && <div style={{ padding: 20, textAlign: 'center', color: '#6b6f6b' }}>Chargement…</div>}
              {error && (
                <div style={{
                  padding: 12, background: 'rgba(184,64,64,.08)',
                  border: '1px solid rgba(184,64,64,.3)', borderRadius: 8,
                  color: '#a04040', fontSize: 13,
                }}>
                  Erreur : {error}
                </div>
              )}
              {!loading && !error && rows.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#6b6f6b' }}>
                  Aucune phase en base. Applique la migration V97.22.1 (seed).
                </div>
              )}
              {!loading && !error && Object.entries(grouped).map(([templateKey, phases]) => (
                <div key={templateKey} style={{ marginBottom: 24 }}>
                  <h3 style={{
                    margin: '0 0 10px', fontSize: 13, fontWeight: 600,
                    color: '#2a2d2a',
                    textTransform: 'uppercase', letterSpacing: '.08em',
                  }}>
                    {templateKey} ({phases.length} phases)
                  </h3>
                  {phases.map((p) => (
                    <PhaseCard
                      key={p.id}
                      phase={p}
                      expanded={expandedId === p.id}
                      onToggleExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      onSave={(patch) => handleSave(p.id, patch, p)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}

          {tab === 'history' && (
            <HistorySection entries={auditEntries} loading={auditLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PhaseCard ───────────────────────────────────────────────────────────

function PhaseCard({ phase, expanded, onToggleExpand, onSave }) {
  const [draft, setDraft] = useState(phase);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => { setDraft(phase); }, [phase]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(phase);

  const handleSubmit = async () => {
    setSaving(true);
    setSaveMsg(null);
    const res = await onSave({
      client_name: draft.client_name,
      clinical_name: draft.clinical_name,
      foods_favor: draft.foods_favor,
      foods_limit: draft.foods_limit,
      cooking: draft.cooking,
      cooking_avoid: draft.cooking_avoid,
      supplements: draft.supplements,
      clinical_notes: draft.clinical_notes,
      enabled: draft.enabled,
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg({ ok: true, text: 'Enregistré' });
      setTimeout(() => setSaveMsg(null), 2500);
    } else {
      setSaveMsg({ ok: false, text: res.error });
    }
  };

  return (
    <div style={{
      marginBottom: 10,
      background: 'white',
      border: '1px solid rgba(0,0,0,.08)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div
        onClick={onToggleExpand}
        style={{
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer',
          background: phase.enabled ? 'transparent' : 'rgba(0,0,0,.03)',
        }}
      >
        <span style={{ fontSize: 12, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s' }}>▶</span>
        <div style={{
          padding: '2px 8px', borderRadius: 4,
          background: '#2E5E3E', color: 'white',
          fontSize: 10, fontWeight: 700,
        }}>P{phase.phase_order}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {phase.client_name}
            <span style={{ marginLeft: 8, fontSize: 11, color: '#6b6f6b', fontWeight: 400 }}>
              · clinique : {phase.clinical_name}
            </span>
            {!phase.enabled && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 999,
                background: 'rgba(0,0,0,.08)', color: '#6b6f6b',
              }}>désactivé</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6b6f6b', marginTop: 2 }}>
            {(phase.foods_favor || []).length} à privilégier
            {' · '}
            {(phase.foods_limit || []).length} à limiter
            {' · '}
            {(phase.supplements || []).length} compléments
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(0,0,0,.05)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              />
              Activé
            </label>
            <input
              type="text"
              value={draft.client_name || ''}
              onChange={(e) => setDraft({ ...draft, client_name: e.target.value })}
              placeholder="Nom côté cliente"
              style={inputStyle}
            />
            <input
              type="text"
              value={draft.clinical_name || ''}
              onChange={(e) => setDraft({ ...draft, clinical_name: e.target.value })}
              placeholder="Nom clinique interne"
              style={{ ...inputStyle, flex: '0 0 30%' }}
            />
          </div>

          <TagEditor
            label="Aliments à privilégier"
            values={draft.foods_favor || []}
            onChange={(v) => setDraft({ ...draft, foods_favor: v })}
            color="#2E5E3E"
          />
          <TagEditor
            label="Aliments à limiter / éviter"
            values={draft.foods_limit || []}
            onChange={(v) => setDraft({ ...draft, foods_limit: v })}
            color="#a04040"
          />
          <TagEditor
            label="Modes de cuisson"
            values={draft.cooking || []}
            onChange={(v) => setDraft({ ...draft, cooking: v })}
            color="#785a1a"
          />
          <TagEditor
            label="Cuissons à éviter"
            values={draft.cooking_avoid || []}
            onChange={(v) => setDraft({ ...draft, cooking_avoid: v })}
            color="#a04040"
          />

          <SupplementsEditor
            value={draft.supplements || []}
            onChange={(v) => setDraft({ ...draft, supplements: v })}
          />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Notes cliniques</div>
            <textarea
              value={draft.clinical_notes || ''}
              onChange={(e) => setDraft({ ...draft, clinical_notes: e.target.value })}
              rows={4}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 12,
                border: '1px solid rgba(0,0,0,.15)', borderRadius: 6,
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <button
              onClick={handleSubmit}
              disabled={saving || !dirty}
              style={{
                background: dirty ? '#2E5E3E' : 'rgba(0,0,0,.15)',
                color: 'white', border: 'none',
                padding: '8px 18px', borderRadius: 6,
                fontSize: 13, fontWeight: 600,
                cursor: (dirty && !saving) ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {dirty && !saving && (
              <button
                onClick={() => setDraft(phase)}
                style={{
                  background: 'transparent', border: '1px solid rgba(0,0,0,.15)',
                  padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
            )}
            {saveMsg && (
              <span style={{
                fontSize: 12,
                color: saveMsg.ok ? '#2E5E3E' : '#a04040',
                fontWeight: 600,
              }}>
                {saveMsg.ok ? '✓ ' : '⚠ '}{saveMsg.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TagEditor (similaire ClinicalGuardrailsPanel) ───────────────────────

function TagEditor({ label, values, onChange, color = '#6b6f6b' }) {
  const [input, setInput] = useState('');
  const addTag = () => {
    const t = input.trim();
    if (!t || values.includes(t)) { setInput(''); return; }
    onChange([...values, t]);
    setInput('');
  };
  const removeTag = (tag) => onChange(values.filter((v) => v !== tag));

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, minHeight: 36,
        background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 6,
      }}>
        {values.map((v) => (
          <span key={v} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', background: 'white',
            border: `1px solid ${color}40`,
            color, borderRadius: 999, fontSize: 11.5, fontWeight: 500,
          }}>
            {v}
            <button
              onClick={() => removeTag(v)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color, fontSize: 14, padding: 0, lineHeight: 1, fontWeight: 700,
              }}
              title="Retirer"
            >×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="Ajouter et presser Entrée"
          style={inputStyle}
        />
        <button
          onClick={addTag}
          disabled={!input.trim()}
          style={{
            background: input.trim() ? color : 'rgba(0,0,0,.1)',
            color: 'white', border: 'none',
            padding: '6px 14px', borderRadius: 6,
            fontSize: 12, fontWeight: 600,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

// ─── SupplementsEditor (jsonb [{name, dose, timing}]) ────────────────────

function SupplementsEditor({ value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const [newName, setNewName] = useState('');
  const [newDose, setNewDose] = useState('');
  const [newTiming, setNewTiming] = useState('');

  const addItem = () => {
    if (!newName.trim()) return;
    onChange([...items, {
      name: newName.trim(),
      dose: newDose.trim(),
      timing: newTiming.trim(),
    }]);
    setNewName(''); setNewDose(''); setNewTiming('');
  };

  const updateItem = (i, field, val) => {
    const next = items.map((it, j) => j === i ? { ...it, [field]: val } : it);
    onChange(next);
  };

  const removeItem = (i) => onChange(items.filter((_, j) => j !== i));

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        Compléments alimentaires
      </div>
      <div style={{
        padding: 8, background: 'rgba(0,0,0,.02)',
        border: '1px solid rgba(0,0,0,.08)', borderRadius: 6,
      }}>
        {items.length === 0 && (
          <div style={{ fontSize: 11, color: '#9a9d9a', fontStyle: 'italic' }}>
            Aucun complément. Ajoute-en ci-dessous.
          </div>
        )}
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input
              type="text" value={it.name || ''}
              onChange={(e) => updateItem(i, 'name', e.target.value)}
              placeholder="Nom"
              style={{ ...inputStyle, flex: 2 }}
            />
            <input
              type="text" value={it.dose || ''}
              onChange={(e) => updateItem(i, 'dose', e.target.value)}
              placeholder="Dose"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="text" value={it.timing || ''}
              onChange={(e) => updateItem(i, 'timing', e.target.value)}
              placeholder="Timing"
              style={{ ...inputStyle, flex: 2 }}
            />
            <button
              onClick={() => removeItem(i)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#a04040', fontSize: 14, padding: '0 6px', fontWeight: 700,
              }}
              title="Retirer"
            >×</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          type="text" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom complément"
          style={{ ...inputStyle, flex: 2 }}
        />
        <input
          type="text" value={newDose}
          onChange={(e) => setNewDose(e.target.value)}
          placeholder="Dose (ex: 5 g)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          type="text" value={newTiming}
          onChange={(e) => setNewTiming(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="Timing"
          style={{ ...inputStyle, flex: 2 }}
        />
        <button
          onClick={addItem}
          disabled={!newName.trim()}
          style={{
            background: newName.trim() ? '#6b6f6b' : 'rgba(0,0,0,.1)',
            color: 'white', border: 'none',
            padding: '6px 14px', borderRadius: 6,
            fontSize: 12, fontWeight: 600,
            cursor: newName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

// ─── TabButton & HistorySection (réutilise pattern) ──────────────────────

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none',
        padding: '10px 14px', fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? '#2a2d2a' : '#6b6f6b',
        borderBottom: `2px solid ${active ? '#2E5E3E' : 'transparent'}`,
        cursor: 'pointer', marginBottom: -1,
      }}
    >{children}</button>
  );
}

function HistorySection({ entries, loading }) {
  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#6b6f6b' }}>Chargement…</div>;
  if (!entries || entries.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#6b6f6b', fontSize: 13 }}>
        Aucune modification enregistrée.
        <div style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
          Les modifs faites depuis ce cockpit seront tracées ici.
        </div>
      </div>
    );
  }
  return <div>{entries.map((e) => <AuditEntry key={e.id} entry={e} />)}</div>;
}

function AuditEntry({ entry }) {
  const [showDiff, setShowDiff] = useState(false);
  const diff = entry.diff || {};
  const changedFields = Object.keys(diff);
  const date = entry.created_at ? new Date(entry.created_at) : null;

  return (
    <div style={{
      marginBottom: 8, background: 'white',
      border: '1px solid rgba(0,0,0,.08)', borderRadius: 8,
      padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div>
          <strong>{entry.template_key} / {entry.phase_id}</strong>
          <span style={{ marginLeft: 6, color: '#6b6f6b' }}>· {entry.action}</span>
          {entry.changed_by && (
            <span style={{ marginLeft: 6, color: '#6b6f6b' }}>
              · par <code style={{ fontSize: 11 }}>{entry.changed_by}</code>
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#9a9d9a' }}>
          {date ? date.toLocaleString('fr-CH', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
          }) : '—'}
        </span>
      </div>
      {changedFields.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, color: '#6b6f6b' }}>
            {changedFields.length} champ{changedFields.length > 1 ? 's' : ''} modifié{changedFields.length > 1 ? 's' : ''} :{' '}
            {changedFields.map((f) => (
              <code key={f} style={{
                fontSize: 10, padding: '1px 6px', marginRight: 4,
                background: 'rgba(0,0,0,.04)', borderRadius: 4,
              }}>{f}</code>
            ))}
            <button
              onClick={() => setShowDiff(!showDiff)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#7e5ec7', fontSize: 11, padding: 0, marginLeft: 4,
                textDecoration: 'underline',
              }}
            >
              {showDiff ? 'masquer' : 'voir diff'}
            </button>
          </div>
          {showDiff && (
            <pre style={{
              marginTop: 6, padding: 10,
              background: 'rgba(0,0,0,.04)', borderRadius: 6,
              fontSize: 10.5, color: '#2a2d2a',
              maxHeight: 240, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{JSON.stringify(diff, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,.5)', zIndex: 9999,
  display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
  padding: '40px 20px', overflowY: 'auto',
};

const modalStyle = {
  background: '#fbf9f4', borderRadius: 14,
  maxWidth: 980, width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,.25)',
  display: 'flex', flexDirection: 'column',
  maxHeight: 'calc(100vh - 80px)',
};

const headerStyle = {
  padding: '18px 22px',
  borderBottom: '1px solid rgba(0,0,0,.08)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
};

const closeBtnStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 24, lineHeight: 1, color: '#6b6f6b', padding: 0,
};

const bodyStyle = {
  padding: 18, overflowY: 'auto', flex: 1,
};

const inputStyle = {
  flex: 1, padding: '6px 10px', fontSize: 12,
  border: '1px solid rgba(0,0,0,.15)', borderRadius: 6,
};
