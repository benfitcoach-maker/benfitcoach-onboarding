// ─── ClinicalGuardrailsPanel.jsx ────────────────────────────────────────
// V97.19 — Cockpit UI Anissa pour gerer la matrice des garde-fous cliniques.
//
// Cf spec : spec-composer-v97-clinical-antislop.md (Phase 5)
// Cf service : services/clinicalGuardrailsService.js
//
// Modal pleine page (overlay) avec liste des 7 profils. Pour chaque profil :
//   - Toggle enabled
//   - Edit display_name
//   - Tag editor pour forbidden_phrases, required_phrases, micronutrients,
//     evictions
//   - Pair editor pour precaution_vocab (key -> value)
//
// Sauvegarde individuelle par profil (bouton Enregistrer). Cache _dbCache
// auto-invalide post-save (force refresh dans clinicalGuardrailsService).

import { useState, useEffect } from 'react';
import { listAllGuardrails, updateGuardrail } from '../services/clinicalGuardrailsService';

export default function ClinicalGuardrailsPanel({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guardrails, setGuardrails] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await listAllGuardrails();
      if (!alive) return;
      if (res.ok) {
        setGuardrails(res.data);
        setError(null);
      } else {
        setError(res.error || 'erreur chargement');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const handleSave = async (id, patch) => {
    const res = await updateGuardrail(id, patch);
    if (res.ok) {
      // Reload list pour refleter le serveur
      const refresh = await listAllGuardrails();
      if (refresh.ok) setGuardrails(refresh.data);
    }
    return res;
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Garde-fous cliniques
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b6f6b' }}>
              Matrice des règles non-négociables injectées dans le composer IA.
              {' '}Édite les phrases interdites, micronutriments, évictions par profil.
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle} title="Fermer">×</button>
        </div>

        <div style={bodyStyle}>
          {loading && <div style={{ padding: 20, textAlign: 'center', color: '#6b6f6b' }}>Chargement...</div>}
          {error && (
            <div style={{
              padding: 12, background: 'rgba(184,64,64,.08)',
              border: '1px solid rgba(184,64,64,.3)', borderRadius: 8,
              color: '#a04040', fontSize: 13,
            }}>
              Erreur : {error}
            </div>
          )}
          {!loading && !error && guardrails.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b6f6b' }}>
              Aucun guardrail en base. Applique la migration V97.18.1 (seed).
            </div>
          )}
          {!loading && !error && guardrails.map((g) => (
            <GuardrailCard
              key={g.id}
              guardrail={g}
              expanded={expandedId === g.id}
              onToggleExpand={() => setExpandedId(expandedId === g.id ? null : g.id)}
              onSave={(patch) => handleSave(g.id, patch)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GuardrailCard ───────────────────────────────────────────────────────

function GuardrailCard({ guardrail, expanded, onToggleExpand, onSave }) {
  const [draft, setDraft] = useState(guardrail);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Sync draft si guardrail change (reload post-save)
  useEffect(() => { setDraft(guardrail); }, [guardrail]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(guardrail);

  const handleSubmit = async () => {
    setSaving(true);
    setSaveMsg(null);
    const res = await onSave({
      display_name: draft.display_name,
      forbidden_phrases: draft.forbidden_phrases,
      required_phrases: draft.required_phrases,
      micronutrients: draft.micronutrients,
      evictions: draft.evictions,
      precaution_vocab: draft.precaution_vocab,
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
      marginBottom: 12,
      background: 'white',
      border: '1px solid rgba(0,0,0,.08)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header card */}
      <div
        onClick={onToggleExpand}
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          background: guardrail.enabled ? 'transparent' : 'rgba(0,0,0,.03)',
        }}
      >
        <span style={{ fontSize: 12, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s' }}>
          ▶
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {guardrail.display_name}
            {!guardrail.enabled && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 999,
                background: 'rgba(0,0,0,.08)', color: '#6b6f6b',
              }}>désactivé</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6b6f6b', marginTop: 2 }}>
            <code style={{ fontSize: 10 }}>{guardrail.profile_key}</code>
            {' · '}
            {guardrail.forbidden_phrases?.length || 0} interdites
            {' · '}
            {guardrail.micronutrients?.length || 0} micros
            {' · '}
            {guardrail.evictions?.length || 0} évictions
            {' · '}
            {guardrail.required_phrases?.length || 0} requises
          </div>
        </div>
      </div>

      {/* Body expanded */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(0,0,0,.05)' }}>
          {/* Enabled toggle + display name */}
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
              value={draft.display_name || ''}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
              placeholder="Nom affiché"
              style={{
                flex: 1, padding: '6px 10px', fontSize: 13,
                border: '1px solid rgba(0,0,0,.15)', borderRadius: 6,
              }}
            />
          </div>

          <TagEditor
            label="Phrases interdites"
            hint="À NE JAMAIS dire. Détectées par audit post-génération (case-insensitive)."
            values={draft.forbidden_phrases || []}
            onChange={(v) => setDraft({ ...draft, forbidden_phrases: v })}
            color="#a04040"
          />
          <TagEditor
            label="Phrases requises"
            hint="Doivent apparaître sémantiquement dans le plan généré."
            values={draft.required_phrases || []}
            onChange={(v) => setDraft({ ...draft, required_phrases: v })}
            color="#2E5E3E"
          />
          <TagEditor
            label="Micronutriments à nommer"
            hint="Sources alimentaires + supplémentation si pertinent."
            values={draft.micronutrients || []}
            onChange={(v) => setDraft({ ...draft, micronutrients: v })}
            color="#785a1a"
          />
          <TagEditor
            label="Évictions à mentionner"
            hint="Aliments/comportements à éviter explicitement."
            values={draft.evictions || []}
            onChange={(v) => setDraft({ ...draft, evictions: v })}
            color="#785a1a"
          />

          <VocabEditor
            label="Vocabulaire de précaution"
            hint="Substitutions obligatoires (chaque occurrence → remplacement)."
            value={draft.precaution_vocab || {}}
            onChange={(v) => setDraft({ ...draft, precaution_vocab: v })}
          />

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
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
                onClick={() => setDraft(guardrail)}
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

// ─── TagEditor : chips + input add ───────────────────────────────────────

function TagEditor({ label, hint, values, onChange, color = '#6b6f6b' }) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const t = input.trim();
    if (!t) return;
    if (values.includes(t)) {
      setInput('');
      return;
    }
    onChange([...values, t]);
    setInput('');
  };

  const removeTag = (tag) => {
    onChange(values.filter((v) => v !== tag));
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: '#6b6f6b', marginBottom: 6 }}>{hint}</div>}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        padding: 8, minHeight: 36,
        background: 'rgba(0,0,0,.02)',
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 6,
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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
          }}
          placeholder="Ajouter un élément et presser Entrée"
          style={{
            flex: 1, padding: '6px 10px', fontSize: 12,
            border: '1px solid rgba(0,0,0,.15)', borderRadius: 6,
          }}
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

// ─── VocabEditor : pairs (key -> value) ──────────────────────────────────

function VocabEditor({ label, hint, value, onChange }) {
  const entries = Object.entries(value || {});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const addPair = () => {
    const k = newKey.trim();
    const v = newVal.trim();
    if (!k || !v) return;
    onChange({ ...value, [k]: v });
    setNewKey('');
    setNewVal('');
  };

  const removePair = (k) => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };

  const updatePair = (k, v) => {
    onChange({ ...value, [k]: v });
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: '#6b6f6b', marginBottom: 6 }}>{hint}</div>}
      <div style={{
        padding: 8,
        background: 'rgba(0,0,0,.02)',
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 6,
      }}>
        {entries.length === 0 && (
          <div style={{ fontSize: 11, color: '#9a9d9a', fontStyle: 'italic' }}>
            Aucune substitution. Ajoute une paire ci-dessous.
          </div>
        )}
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input
              type="text"
              value={k}
              readOnly
              style={{
                flex: 1, padding: '4px 8px', fontSize: 11.5,
                border: '1px solid rgba(0,0,0,.1)', borderRadius: 4,
                background: 'white', fontStyle: 'italic',
              }}
            />
            <span style={{ fontSize: 11, color: '#6b6f6b' }}>→</span>
            <input
              type="text"
              value={v}
              onChange={(e) => updatePair(k, e.target.value)}
              style={{
                flex: 1, padding: '4px 8px', fontSize: 11.5,
                border: '1px solid rgba(0,0,0,.15)', borderRadius: 4,
              }}
            />
            <button
              onClick={() => removePair(k)}
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
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Mot interdit"
          style={{
            flex: 1, padding: '6px 10px', fontSize: 12,
            border: '1px solid rgba(0,0,0,.15)', borderRadius: 6,
          }}
        />
        <span style={{ fontSize: 11, color: '#6b6f6b', alignSelf: 'center' }}>→</span>
        <input
          type="text"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPair(); } }}
          placeholder="Remplacement"
          style={{
            flex: 1, padding: '6px 10px', fontSize: 12,
            border: '1px solid rgba(0,0,0,.15)', borderRadius: 6,
          }}
        />
        <button
          onClick={addPair}
          disabled={!newKey.trim() || !newVal.trim()}
          style={{
            background: (newKey.trim() && newVal.trim()) ? '#6b6f6b' : 'rgba(0,0,0,.1)',
            color: 'white', border: 'none',
            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: (newKey.trim() && newVal.trim()) ? 'pointer' : 'not-allowed',
          }}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,.5)',
  zIndex: 9999,
  display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
  padding: '40px 20px',
  overflowY: 'auto',
};

const modalStyle = {
  background: '#fbf9f4',
  borderRadius: 14,
  maxWidth: 900,
  width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,.25)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'calc(100vh - 80px)',
};

const headerStyle = {
  padding: '18px 22px',
  borderBottom: '1px solid rgba(0,0,0,.08)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 12,
};

const closeBtnStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 24, lineHeight: 1, color: '#6b6f6b', padding: 0,
};

const bodyStyle = {
  padding: 18,
  overflowY: 'auto',
  flex: 1,
};
