// ─── PendingDraftsPanel.jsx ──────────────────────────────────────────────
// V97.23.1 (V97.18 Phase F) — Cockpit UI Anissa pour valider/refuser les
// brouillons IA generes automatiquement aux transitions de phase.
//
// Cf migration : V97.23_plan_drafts_pending_review.sql
// Cf service : services/planDraftsService.js
// Cf auto-gen : services/autoGeneratePlanForPhaseTransition.js
//
// Modal pleine page avec liste des drafts pending (groupes par cliente).
// Click un draft → split view : metadata + draft_text. Boutons Accept
// (convertit en consultation 'a_valider' + marque draft accepted) /
// Refuse (marque draft refused avec note optionnelle).

import { useState, useEffect } from 'react';
import { listPlanDrafts, acceptPlanDraft, refusePlanDraft } from '../services/planDraftsService';
import { saveNutritionConsultation, getNutritionConsultations } from '../store';
import { COACH_IDENTITY } from '../services/coachIdentity';
// V97.23.2 — Accept+Publish atomic workflow (push notif cliente automatique)
import { publishConsultationToClientApp } from '../services/publishToClientApp';
// V97.23.4 — Diff visualization entre V actuelle et draft propose.
import { diffLines, diffStats } from '../services/textDiff';

export default function PendingDraftsPanel({ onClose, clientsById }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [actionState, setActionState] = useState(null); // null | { ok, msg }

  const refresh = async () => {
    setLoading(true);
    const res = await listPlanDrafts({ status: 'pending', limit: 50 });
    if (res.ok) {
      setDrafts(res.data);
      setError(null);
    } else {
      setError(res.error || 'erreur chargement');
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAccept = async (draft, draftTextOverride, note) => {
    setActionState(null);
    const finalText = (draftTextOverride && draftTextOverride.trim().length > 0)
      ? draftTextOverride
      : draft.draft_text;
    try {
      // 1. Cree une consultation (status a_valider) avec le texte du draft
      const next = {
        clientId: draft.client_id,
        nutritionPlan: finalText,
        createdAt: new Date().toISOString(),
        status: 'a_valider',
        consultantName: COACH_IDENTITY?.name || 'Anissa',
        // Trace de l'origine pour debug futur
        sourceDraftId: draft.id,
        sourceMetadata: draft.trigger_metadata || null,
      };
      await saveNutritionConsultation(next);
      // 2. Marque draft accepted
      const accRes = await acceptPlanDraft(draft.id, note);
      if (!accRes.ok) {
        setActionState({ ok: false, msg: `Consultation cree mais marquage draft echec : ${accRes.error}` });
      } else {
        setActionState({ ok: true, msg: 'Brouillon accepte. Consultation creee (status à valider).' });
      }
      // 3. Reload list et clear selected
      setSelectedDraft(null);
      await refresh();
    } catch (e) {
      setActionState({ ok: false, msg: e?.message || 'erreur conversion' });
    }
  };

  /**
   * V97.23.2 — Workflow atomique Accept+Publish.
   * Cree la consultation (statut 'publie' direct), publie vers l'app cliente
   * (qui declenche push notif PWA), marque le draft accepted. Best-effort
   * sur la publication : si echec, la consultation reste creee, Anissa peut
   * re-publier manuellement via flow normal.
   */
  const handleAcceptAndPublish = async (draft, draftTextOverride, note) => {
    setActionState(null);
    const finalText = (draftTextOverride && draftTextOverride.trim().length > 0)
      ? draftTextOverride
      : draft.draft_text;
    const client = clientsById?.[draft.client_id];
    if (!client) {
      setActionState({ ok: false, msg: 'Cliente introuvable dans la liste — impossible de publier.' });
      return;
    }
    try {
      const consultation = {
        clientId: draft.client_id,
        nutritionPlan: finalText,
        createdAt: new Date().toISOString(),
        status: 'publie',
        consultantName: COACH_IDENTITY?.name || 'Anissa',
        sourceDraftId: draft.id,
        sourceMetadata: draft.trigger_metadata || null,
      };
      await saveNutritionConsultation(consultation);
      // Publie a l'app cliente (push notif declenche)
      let publishedOk = false;
      let publishError = null;
      try {
        await publishConsultationToClientApp(client, consultation);
        publishedOk = true;
      } catch (pe) {
        publishError = pe?.message || 'erreur publication';
      }
      const accRes = await acceptPlanDraft(draft.id, note);
      if (publishedOk) {
        setActionState({
          ok: true,
          msg: accRes.ok
            ? 'Brouillon accepte et publie a la cliente. Push notif envoye.'
            : `Publie OK mais marquage draft echec : ${accRes.error}`,
        });
      } else {
        setActionState({
          ok: false,
          msg: `Consultation creee (statut publie) mais publication app cliente echec : ${publishError}. Re-publie via flow normal SaaS.`,
        });
      }
      setSelectedDraft(null);
      await refresh();
    } catch (e) {
      setActionState({ ok: false, msg: e?.message || 'erreur conversion' });
    }
  };

  const handleRefuse = async (draft, note) => {
    setActionState(null);
    const res = await refusePlanDraft(draft.id, note);
    if (res.ok) {
      setActionState({ ok: true, msg: 'Brouillon refuse.' });
      setSelectedDraft(null);
      await refresh();
    } else {
      setActionState({ ok: false, msg: res.error });
    }
  };

  // Group by client_id
  const grouped = drafts.reduce((acc, d) => {
    if (!acc[d.client_id]) acc[d.client_id] = [];
    acc[d.client_id].push(d);
    return acc;
  }, {});

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Brouillons IA en attente de validation
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b6f6b' }}>
              Plans générés automatiquement aux transitions de phase. Valide ou refuse pour chaque cliente.
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle} title="Fermer">×</button>
        </div>

        {actionState && (
          <div style={{
            padding: '8px 22px', fontSize: 12,
            background: actionState.ok ? 'rgba(46,94,62,.08)' : 'rgba(184,64,64,.08)',
            color: actionState.ok ? '#2E5E3E' : '#a04040',
            borderBottom: '1px solid rgba(0,0,0,.06)',
          }}>
            {actionState.ok ? '✓ ' : '⚠ '}{actionState.msg}
          </div>
        )}

        <div style={bodyStyle}>
          {loading && <div style={{ padding: 30, textAlign: 'center', color: '#6b6f6b' }}>Chargement…</div>}
          {error && (
            <div style={{
              padding: 12, background: 'rgba(184,64,64,.08)',
              border: '1px solid rgba(184,64,64,.3)', borderRadius: 8,
              color: '#a04040', fontSize: 13,
            }}>
              Erreur : {error}
            </div>
          )}
          {!loading && !error && drafts.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: '#6b6f6b', fontSize: 13 }}>
              Aucun brouillon en attente.
              <div style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                Les brouillons apparaîtront ici dès qu&apos;une cliente passe à une nouvelle phase de son parcours.
              </div>
            </div>
          )}
          {!loading && !error && !selectedDraft && Object.entries(grouped).map(([clientId, list]) => {
            const c = clientsById?.[clientId];
            const clientLabel = c?.prenom || c?.form?.prenom || `client ${clientId.slice(0, 8)}…`;
            return (
              <div key={clientId} style={{ marginBottom: 18 }}>
                <h3 style={{
                  margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#2a2d2a',
                }}>{clientLabel} <span style={{ fontWeight: 400, color: '#9a9d9a', fontSize: 11 }}>({list.length})</span></h3>
                {list.map((d) => (
                  <DraftRow key={d.id} draft={d} onClick={() => setSelectedDraft(d)} />
                ))}
              </div>
            );
          })}
          {!loading && !error && selectedDraft && (
            <DraftDetail
              draft={selectedDraft}
              clientsById={clientsById}
              onBack={() => setSelectedDraft(null)}
              onAccept={handleAccept}
              onAcceptAndPublish={handleAcceptAndPublish}
              onRefuse={handleRefuse}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DraftRow (liste compacte) ──────────────────────────────────────────

function DraftRow({ draft, onClick }) {
  const meta = draft.trigger_metadata || {};
  const date = draft.generated_at ? new Date(draft.generated_at) : null;
  const fmtDate = date ? date.toLocaleString('fr-CH', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '—';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px', marginBottom: 6,
        background: 'white', border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{
        padding: '3px 8px', borderRadius: 4,
        background: draft.source === 'auto_phase_transition' ? '#7e5ec7' : '#6b6f6b',
        color: 'white', fontSize: 10, fontWeight: 700,
      }}>
        {draft.source === 'auto_phase_transition' ? 'AUTO' : 'MANUEL'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: '#2a2d2a' }}>
          {meta.template_key && <code style={{ fontSize: 11, marginRight: 6 }}>{meta.template_key}</code>}
          {meta.from_phase_id && meta.to_phase_id && (
            <>
              <span style={{ color: '#6b6f6b' }}>
                <code style={{ fontSize: 10 }}>{meta.from_phase_id}</code>
                {' → '}
                <code style={{ fontSize: 10 }}>{meta.to_phase_id}</code>
              </span>
            </>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9a9d9a', marginTop: 2 }}>
          {draft.draft_length_chars?.toLocaleString('fr-CH') || '—'} caractères
          {' · généré le '}{fmtDate}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#7e5ec7', fontWeight: 600 }}>
        Voir →
      </div>
    </div>
  );
}

// ─── DraftDetail (split view editor + actions) ──────────────────────────

function DraftDetail({ draft, clientsById, onBack, onAccept, onAcceptAndPublish, onRefuse }) {
  const [editedText, setEditedText] = useState(draft.draft_text);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(null); // null | 'accept' | 'acceptPublish' | 'refuse'
  // V97.23.4 — Toggle diff vs full + reference V actuelle fetched on mount
  const [viewMode, setViewMode] = useState('full'); // 'full' | 'diff'
  const [currentV, setCurrentV] = useState(null); // consultation publiee la plus recente

  useEffect(() => {
    // Charge la V actuelle (la plus recente consultation publiee pour la cliente)
    let alive = true;
    (async () => {
      try {
        const list = await getNutritionConsultations(draft.client_id);
        if (!alive || !Array.isArray(list)) return;
        // Trie par date desc et prend la premiere publiee (statut 'publie')
        // Ignore le draft accepted en cours s'il a deja cree une consult
        const published = list
          .filter((c) => c.id !== draft.sourceConsultationId && (c.status === 'publie' || c.status === 'a_valider'))
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setCurrentV(published[0] || null);
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, [draft.client_id, draft.sourceConsultationId]);
  const meta = draft.trigger_metadata || {};
  const c = clientsById?.[draft.client_id];
  const clientLabel = c?.prenom || c?.form?.prenom || `client ${draft.client_id.slice(0, 8)}…`;

  const dirty = editedText !== draft.draft_text;

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'transparent', border: '1px solid rgba(0,0,0,.15)',
          padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          marginBottom: 12, color: '#2a2d2a',
        }}
      >
        ← Retour à la liste
      </button>

      {/* Metadata */}
      <div style={{
        padding: '10px 14px', marginBottom: 12,
        background: 'rgba(126,94,199,.06)', border: '1px solid rgba(126,94,199,.2)',
        borderRadius: 8, fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, color: '#2a2d2a', marginBottom: 4 }}>
          {clientLabel}
        </div>
        <div style={{ color: '#6b6f6b' }}>
          {meta.template_key && <><code style={{ fontSize: 11 }}>{meta.template_key}</code> · </>}
          {meta.from_phase_id && meta.to_phase_id && (
            <>Transition <code>{meta.from_phase_id}</code> → <code>{meta.to_phase_id}</code> · </>
          )}
          {Number.isFinite(meta.generation_duration_ms) && (
            <>{Math.round(meta.generation_duration_ms / 1000)}s génération · </>
          )}
          {meta.profile_tag && <>profil <code>{meta.profile_tag}</code> · </>}
          {meta.phase_recommendations_source && (
            <>source recos <code>{meta.phase_recommendations_source}</code></>
          )}
        </div>
      </div>

      {/* V97.23.4 — Toggle vue plein texte / diff */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
        <button
          onClick={() => setViewMode('full')}
          style={{
            background: viewMode === 'full' ? '#2E5E3E' : 'transparent',
            color: viewMode === 'full' ? 'white' : '#2a2d2a',
            border: `1px solid ${viewMode === 'full' ? '#2E5E3E' : 'rgba(0,0,0,.15)'}`,
            padding: '4px 12px', borderRadius: 6,
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Plein texte
        </button>
        <button
          onClick={() => setViewMode('diff')}
          disabled={!currentV}
          title={!currentV ? 'Aucune version précédente trouvée pour cette cliente' : 'Comparer avec la version actuelle'}
          style={{
            background: viewMode === 'diff' ? '#7e5ec7' : 'transparent',
            color: viewMode === 'diff' ? 'white' : (currentV ? '#2a2d2a' : '#9a9d9a'),
            border: `1px solid ${viewMode === 'diff' ? '#7e5ec7' : 'rgba(0,0,0,.15)'}`,
            padding: '4px 12px', borderRadius: 6,
            fontSize: 11, fontWeight: 600,
            cursor: currentV ? 'pointer' : 'not-allowed',
          }}
        >
          Diff vs V actuelle
        </button>
        {viewMode === 'diff' && currentV && (
          <span style={{ marginLeft: 8, fontSize: 11, color: '#6b6f6b' }}>
            V actuelle : {currentV.createdAt
              ? new Date(currentV.createdAt).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—'}
          </span>
        )}
      </div>

      {viewMode === 'full' && (
        <>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={18}
            style={{
              width: '100%', padding: '10px 12px',
              fontSize: 13, fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              border: '1px solid rgba(0,0,0,.15)', borderRadius: 8,
              background: 'white', resize: 'vertical',
            }}
          />
          <div style={{ fontSize: 10.5, color: '#9a9d9a', marginTop: 4, textAlign: 'right' }}>
            {editedText.length.toLocaleString('fr-CH')} caractères
            {dirty && <span style={{ color: '#785a1a', marginLeft: 8 }}>(modifié)</span>}
          </div>
        </>
      )}

      {viewMode === 'diff' && currentV && (
        <DiffView
          oldText={currentV.nutritionPlan || currentV.nutrition_plan || ''}
          newText={editedText}
        />
      )}

      {/* Note refuse/accept */}
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)"
        style={{
          width: '100%', padding: '8px 12px', marginTop: 10,
          fontSize: 12, border: '1px solid rgba(0,0,0,.15)', borderRadius: 6,
        }}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {confirming === null && (
          <>
            <button
              onClick={() => setConfirming('acceptPublish')}
              style={{
                background: '#2E5E3E', color: 'white', border: 'none',
                padding: '8px 18px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              title="Crée la consultation, publie immédiatement à l'app cliente, déclenche push notif"
            >
              ✓ Accepter et publier
            </button>
            <button
              onClick={() => setConfirming('accept')}
              style={{
                background: 'rgba(46,94,62,.12)', color: '#2E5E3E',
                border: '1px solid rgba(46,94,62,.4)',
                padding: '8px 18px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              title="Crée juste la consultation en statut 'à valider' (Anissa publie plus tard)"
            >
              ✓ Accepter (à valider)
            </button>
            <button
              onClick={() => setConfirming('refuse')}
              style={{
                background: 'transparent', color: '#a04040',
                border: '1px solid rgba(184,64,64,.4)',
                padding: '8px 18px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Refuser
            </button>
          </>
        )}

        {confirming === 'acceptPublish' && (
          <>
            <span style={{ fontSize: 12, color: '#2a2d2a' }}>
              Publier immédiatement à la cliente ? Push notif sera envoyé.
            </span>
            <button
              onClick={() => { setConfirming(null); onAcceptAndPublish(draft, editedText, note); }}
              style={{
                background: '#2E5E3E', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Confirmer publier</button>
            <button
              onClick={() => setConfirming(null)}
              style={{
                background: 'transparent', border: '1px solid rgba(0,0,0,.15)',
                padding: '5px 12px', borderRadius: 6,
                fontSize: 12, cursor: 'pointer',
              }}
            >Annuler</button>
          </>
        )}

        {confirming === 'accept' && (
          <>
            <span style={{ fontSize: 12, color: '#2a2d2a' }}>
              Créer une consultation (status &quot;à valider&quot;) avec ce texte ?
            </span>
            <button
              onClick={() => { setConfirming(null); onAccept(draft, editedText, note); }}
              style={{
                background: '#2E5E3E', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Confirmer accept</button>
            <button
              onClick={() => setConfirming(null)}
              style={{
                background: 'transparent', border: '1px solid rgba(0,0,0,.15)',
                padding: '5px 12px', borderRadius: 6,
                fontSize: 12, cursor: 'pointer',
              }}
            >Annuler</button>
          </>
        )}

        {confirming === 'refuse' && (
          <>
            <span style={{ fontSize: 12, color: '#2a2d2a' }}>
              Refuser ce brouillon ? Il restera en DB pour audit.
            </span>
            <button
              onClick={() => { setConfirming(null); onRefuse(draft, note); }}
              style={{
                background: '#a04040', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Confirmer refus</button>
            <button
              onClick={() => setConfirming(null)}
              style={{
                background: 'transparent', border: '1px solid rgba(0,0,0,.15)',
                padding: '5px 12px', borderRadius: 6,
                fontSize: 12, cursor: 'pointer',
              }}
            >Annuler</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── DiffView (V97.23.4) : visualisation diff line par line ──────────────

function DiffView({ oldText, newText }) {
  const ops = diffLines(oldText, newText);
  const stats = diffStats(ops);

  return (
    <div>
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '6px 10px', marginBottom: 6,
        background: 'rgba(126,94,199,.06)',
        border: '1px solid rgba(126,94,199,.2)',
        borderRadius: 6, fontSize: 11,
      }}>
        <span style={{ fontWeight: 600, color: '#2a2d2a' }}>{stats.total} lignes</span>
        <span style={{ color: '#2E5E3E' }}>+{stats.added} ajoutée{stats.added > 1 ? 's' : ''}</span>
        <span style={{ color: '#a04040' }}>−{stats.removed} retirée{stats.removed > 1 ? 's' : ''}</span>
        <span style={{ color: '#6b6f6b' }}>={stats.unchanged} inchangée{stats.unchanged > 1 ? 's' : ''}</span>
      </div>
      <div style={{
        padding: 0, background: 'white',
        border: '1px solid rgba(0,0,0,.15)', borderRadius: 8,
        overflow: 'auto', maxHeight: 500,
        fontSize: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        lineHeight: 1.55,
      }}>
        {ops.length === 0 && (
          <div style={{ padding: 16, color: '#9a9d9a', fontStyle: 'italic', textAlign: 'center' }}>
            Aucune différence détectée.
          </div>
        )}
        {ops.map((op, i) => {
          const isAdded = op.type === 'added';
          const isRemoved = op.type === 'removed';
          const bg = isAdded
            ? 'rgba(46,94,62,.10)'
            : isRemoved
              ? 'rgba(184,64,64,.10)'
              : 'transparent';
          const marker = isAdded ? '+' : isRemoved ? '−' : ' ';
          const color = isAdded ? '#2E5E3E' : isRemoved ? '#a04040' : '#2a2d2a';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                background: bg,
                padding: '2px 0',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}
            >
              <span style={{
                flex: '0 0 24px', textAlign: 'center', color,
                userSelect: 'none', fontWeight: 700,
              }}>
                {marker}
              </span>
              <span style={{
                flex: 1, color,
                paddingRight: 10,
                textDecoration: isRemoved ? 'line-through' : 'none',
                opacity: op.type === 'unchanged' ? 0.6 : 1,
              }}>
                {op.text || ' '}
              </span>
            </div>
          );
        })}
      </div>
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
