// ─────────────────────────────────────────────────────────────────
// Phase AC — Panel latéral Messages SaaS ↔ cliente
// Date : 2026-05-10
//
// Panel droit slide-in dans le parcours, accessible via bouton "💬 Messages"
// du header. Combine 2 sections :
//
//   1. Conversation (messages SaaS → cliente)
//      - Liste paginée des messages envoyés (fetchCoachMessages)
//      - Champ pour écrire et envoyer un nouveau message (sendCoachMessage)
//      - Push-notifié côté app cliente
//
//   2. Ressentis cliente (feedbacks entrants)
//      - Lecture seule, derniers 7 jours
//      - Sert à voir les ressentis quotidiens / messages cliente
//
// Pas d'écriture côté cliente depuis ce panel — le push-back vient
// naturellement via les feedbacks.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { sendCoachMessage, fetchCoachMessages } from './services/sendCoachMessage';
import { fetchClientFeedbacks } from './services/fetchClientFeedbacks';

export default function JourneyMessagesPanel({ client, onClose }) {
  const email = client?.form?.email || client?.email || '';
  const prenom = client?.prenom || client?.form?.prenom || 'Cliente';

  const [tab, setTab] = useState('conversation');
  const [messages, setMessages] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [loadingFb, setLoadingFb] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const loadMessages = useCallback(async () => {
    if (!email) {
      setLoadingMsg(false);
      return;
    }
    setLoadingMsg(true);
    try {
      const { messages: msgs } = await fetchCoachMessages({ email, limit: 50 });
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      setError(e?.message || 'Erreur chargement messages');
    } finally {
      setLoadingMsg(false);
    }
  }, [email]);

  const loadFeedbacks = useCallback(async () => {
    if (!client?.id) {
      setLoadingFb(false);
      return;
    }
    setLoadingFb(true);
    try {
      const res = await fetchClientFeedbacks(client, 14);
      setFeedbacks(Array.isArray(res) ? res : (res?.feedbacks || []));
    } catch {
      // silencieux : la cliente peut ne pas avoir l'app activée
      setFeedbacks([]);
    } finally {
      setLoadingFb(false);
    }
  }, [client]);

  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { loadFeedbacks(); }, [loadFeedbacks]);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!email) {
      setError('Cliente sans email — ajoute son email dans la fiche.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendCoachMessage({ email, body: trimmed, source: 'manual' });
      setDraft('');
      await loadMessages();
    } catch (e) {
      setError(e?.message || 'Erreur envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="jmp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} />
      <aside className="jmp-panel">
        <header className="jmp-head">
          <div>
            <p className="jrn-step-eyebrow">Messages cliente</p>
            <h2 className="jmp-head__title">{prenom}</h2>
            {!email && <p className="jmp-warning">⚠ Cliente sans email — pas d'envoi possible.</p>}
          </div>
          <button onClick={onClose} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>

        <div className="jmp-tabs">
          <button onClick={() => setTab('conversation')} className={`jpe-tab ${tab === 'conversation' ? 'jpe-tab--active' : ''}`}>
            Conversation ({messages.length})
          </button>
          <button onClick={() => setTab('feedbacks')} className={`jpe-tab ${tab === 'feedbacks' ? 'jpe-tab--active' : ''}`}>
            Ressentis ({feedbacks.length})
          </button>
        </div>

        <div className="jmp-body">
          {tab === 'conversation' && (
            <ConversationTab
              messages={messages}
              loading={loadingMsg}
              draft={draft}
              setDraft={setDraft}
              onSend={handleSend}
              sending={sending}
              disabled={!email}
            />
          )}
          {tab === 'feedbacks' && (
            <FeedbacksTab
              feedbacks={feedbacks}
              loading={loadingFb}
            />
          )}
        </div>

        {error && <div className="jrn-error" style={{ padding: '10px 18px' }}>⚠ {error}</div>}
      </aside>

      <style>{`
        .jmp-overlay {
          position: fixed; inset: 0;
          background: rgba(15,15,15,0.4);
          z-index: 90;
          animation: jmp-fade 180ms ease;
        }
        @keyframes jmp-fade { from { opacity: 0 } to { opacity: 1 } }
        .jmp-panel {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 480px;
          max-width: 92vw;
          background: var(--jrn-surface);
          box-shadow: -16px 0 48px rgba(15,15,15,0.18);
          display: flex; flex-direction: column;
          z-index: 91;
          animation: jmp-slide 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
          font-family: var(--jrn-font-body);
        }
        @keyframes jmp-slide { from { transform: translateX(100%) } to { transform: translateX(0) } }
        .jmp-head {
          padding: 20px 24px;
          border-bottom: 1px solid var(--jrn-border);
          display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
        }
        .jmp-head__title {
          font-family: var(--jrn-font-display);
          font-style: italic;
          font-size: 22px;
          font-weight: 600;
          margin: 4px 0 0;
          color: var(--jrn-text);
        }
        .jmp-warning {
          font-size: 11px;
          color: var(--jrn-warn);
          margin: 6px 0 0;
        }
        .jmp-tabs {
          display: flex;
          gap: 0;
          padding: 0 16px;
          border-bottom: 1px solid var(--jrn-border);
          background: var(--jrn-surface-alt);
        }
        .jmp-body {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .jmp-conv {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .jmp-msg {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.55;
          max-width: 85%;
          word-wrap: break-word;
        }
        .jmp-msg--out {
          background: var(--jrn-accent);
          color: var(--jrn-surface);
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        .jmp-msg--in {
          background: var(--jrn-bg-alt);
          color: var(--jrn-text);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        .jmp-msg__meta {
          font-size: 10px;
          opacity: 0.75;
          margin-top: 4px;
        }
        .jmp-input {
          padding: 12px 14px;
          border-top: 1px solid var(--jrn-border);
          background: var(--jrn-surface-alt);
        }
        .jmp-textarea {
          width: 100%;
          padding: 10px 12px;
          font-family: inherit;
          font-size: 13px;
          line-height: 1.5;
          color: var(--jrn-text);
          background: var(--jrn-surface);
          border: 1px solid var(--jrn-border-strong);
          border-radius: 8px;
          resize: vertical;
          margin-bottom: 8px;
        }
        .jmp-textarea:focus {
          outline: none;
          border-color: var(--jrn-accent);
          box-shadow: 0 0 0 3px var(--jrn-accent-soft);
        }
        .jmp-empty {
          text-align: center;
          padding: 40px 20px;
          color: var(--jrn-text-muted);
          font-size: 13px;
        }
        .jmp-fb {
          padding: 12px 14px;
          border-bottom: 1px solid var(--jrn-border);
          font-size: 13px;
        }
        .jmp-fb__date {
          font-size: 10px;
          color: var(--jrn-text-muted);
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 4px;
        }
        .jmp-fb__body {
          color: var(--jrn-text);
          line-height: 1.55;
          white-space: pre-wrap;
        }
      `}</style>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// Tab : Conversation
// ═════════════════════════════════════════════════════════════

function ConversationTab({ messages, loading, draft, setDraft, onSend, sending, disabled }) {
  return (
    <>
      <div className="jmp-conv">
        {loading && <div className="jmp-empty">Chargement…</div>}
        {!loading && messages.length === 0 && (
          <div className="jmp-empty">
            Aucun message envoyé pour l'instant.<br />
            Écrivez ci-dessous votre premier message.
          </div>
        )}
        {!loading && [...messages].reverse().map((m, i) => (
          <div key={m.id || i} className="jmp-msg jmp-msg--out">
            <div>{m.body}</div>
            <div className="jmp-msg__meta">
              {formatDate(m.created_at)} {m.source && m.source !== 'manual' && `· ${m.source}`}
            </div>
          </div>
        ))}
      </div>
      <div className="jmp-input">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="jmp-textarea"
          placeholder={disabled ? 'Cliente sans email — pas d\'envoi possible' : 'Écrire un message à la cliente…'}
          disabled={disabled || sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--jrn-text-muted)' }}>
            Cmd/Ctrl + Entrée pour envoyer
          </span>
          <button
            onClick={onSend}
            disabled={disabled || sending || !draft.trim()}
            className="jrn-btn jrn-btn--primary"
          >
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// Tab : Ressentis cliente
// ═════════════════════════════════════════════════════════════

function FeedbacksTab({ feedbacks, loading }) {
  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {loading && <div className="jmp-empty">Chargement…</div>}
      {!loading && feedbacks.length === 0 && (
        <div className="jmp-empty">
          Aucun ressenti reçu sur les 14 derniers jours.<br />
          La cliente peut envoyer des ressentis depuis l'app.
        </div>
      )}
      {!loading && feedbacks.map((f, i) => (
        <div key={f.id || i} className="jmp-fb">
          <div className="jmp-fb__date">{formatDate(f.created_at || f.date)}</div>
          <div className="jmp-fb__body">{f.body || f.text || f.message || JSON.stringify(f)}</div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
