// ─────────────────────────────────────────────────────────────────
// Phase AE — Panel latéral Notes internes Anissa
// Date : 2026-05-11
//
// Panel droit slide-in dans le parcours, accessible via bouton "📝 Notes"
// du header. Texte libre privé sur la cliente, jamais envoyé à elle.
//
// Auto-save debouncé (1.5s après la dernière frappe) pour éviter
// le clic manuel à chaque modification. Indicateur visuel discret.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { fetchClientNotes, saveClientNotes } from './services/clientNotes';

const AUTOSAVE_DELAY_MS = 1500;

export default function JourneyNotesPanel({ client, onClose }) {
  const clientId = client?.id;
  const prenom = client?.prenom || client?.form?.prenom || 'Cliente';

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingState, setSavingState] = useState('idle'); // idle | dirty | saving | saved | error
  const [error, setError] = useState(null);
  const lastSavedRef = useRef('');
  const debounceRef = useRef(null);

  // Initial load
  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const notes = await fetchClientNotes(clientId);
        if (cancelled) return;
        setText(notes);
        lastSavedRef.current = notes;
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Erreur chargement notes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  // Autosave debouncé
  useEffect(() => {
    if (loading) return;
    if (text === lastSavedRef.current) return;
    setSavingState('dirty');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSavingState('saving');
      setError(null);
      try {
        const saved = await saveClientNotes(clientId, text);
        lastSavedRef.current = saved;
        setSavingState('saved');
        setTimeout(() => setSavingState((s) => (s === 'saved' ? 'idle' : s)), 1800);
      } catch (e) {
        setError(e?.message || 'Erreur sauvegarde');
        setSavingState('error');
      }
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, clientId, loading]);

  // Sauvegarde immédiate à la fermeture si dirty
  const handleClose = async () => {
    if (savingState === 'dirty' || savingState === 'saving') {
      try {
        await saveClientNotes(clientId, text);
      } catch { /* silencieux à la fermeture */ }
    }
    onClose();
  };

  const charCount = text.length;
  const lastEdit = text !== lastSavedRef.current;

  return (
    <>
      <div className="jnp-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }} />
      <aside className="jnp-panel">
        <header className="jnp-head">
          <div>
            <p className="jrn-step-eyebrow">Notes internes</p>
            <h2 className="jnp-head__title">{prenom}</h2>
            <p className="jnp-head__sub">Privé — jamais envoyé à la cliente</p>
          </div>
          <button onClick={handleClose} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>

        <div className="jnp-body">
          {loading ? (
            <div style={{ color: 'var(--jrn-text-muted)', padding: 'var(--jrn-5)', textAlign: 'center', fontSize: 13 }}>
              Chargement…
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="jnp-textarea"
              placeholder="Notes libres : observations, hypothèses, points à creuser, ressentis cabinet, contexte personnel sensible, profil psycho…"
              autoFocus
            />
          )}
        </div>

        <footer className="jnp-footer">
          <span style={{ fontSize: 11, color: 'var(--jrn-text-muted)' }}>
            {charCount.toLocaleString('fr-CH')} caractère{charCount > 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--jrn-font-ui)' }}>
            {savingState === 'saving' && <span style={{ color: 'var(--jrn-text-muted)' }}>⟳ Sauvegarde…</span>}
            {savingState === 'saved' && <span style={{ color: 'var(--jrn-accent)' }}>✓ Sauvegardé</span>}
            {savingState === 'dirty' && <span style={{ color: 'var(--jrn-warn)' }}>● Modifications non sauvegardées…</span>}
            {savingState === 'error' && <span style={{ color: 'var(--jrn-error)' }}>⚠ Erreur</span>}
            {savingState === 'idle' && !lastEdit && <span style={{ color: 'var(--jrn-text-muted)' }}>Auto-sauvegarde activée</span>}
          </span>
        </footer>

        {error && <div className="jrn-error" style={{ padding: '8px 18px' }}>⚠ {error}</div>}
      </aside>

      <style>{`
        .jnp-overlay {
          position: fixed; inset: 0;
          background: rgba(15,15,15,0.4);
          z-index: 90;
          animation: jnp-fade 180ms ease;
        }
        @keyframes jnp-fade { from { opacity: 0 } to { opacity: 1 } }
        .jnp-panel {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 480px;
          max-width: 92vw;
          background: var(--jrn-surface);
          box-shadow: -16px 0 48px rgba(15,15,15,0.18);
          display: flex; flex-direction: column;
          z-index: 91;
          animation: jnp-slide 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
          font-family: var(--jrn-font-body);
        }
        @keyframes jnp-slide { from { transform: translateX(100%) } to { transform: translateX(0) } }
        .jnp-head {
          padding: 20px 24px;
          border-bottom: 1px solid var(--jrn-border);
          display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
          background: var(--jrn-surface);
        }
        .jnp-head__title {
          font-family: var(--jrn-font-display);
          font-style: italic;
          font-size: 22px;
          font-weight: 600;
          margin: 4px 0 0;
          color: var(--jrn-text);
        }
        .jnp-head__sub {
          margin: 4px 0 0;
          font-size: 11px;
          color: var(--jrn-text-muted);
          letter-spacing: .02em;
        }
        .jnp-body {
          flex: 1;
          overflow: hidden;
          display: flex;
          padding: 16px 18px;
        }
        .jnp-textarea {
          flex: 1;
          width: 100%;
          padding: 14px 16px;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.65;
          color: var(--jrn-text);
          background: var(--jrn-surface-alt);
          border: 1px solid var(--jrn-border);
          border-radius: 8px;
          resize: none;
        }
        .jnp-textarea:focus {
          outline: none;
          border-color: var(--jrn-accent);
          box-shadow: 0 0 0 3px var(--jrn-accent-soft);
          background: var(--jrn-surface);
        }
        .jnp-footer {
          padding: 10px 20px;
          border-top: 1px solid var(--jrn-border);
          background: var(--jrn-surface-alt);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
      `}</style>
    </>
  );
}
