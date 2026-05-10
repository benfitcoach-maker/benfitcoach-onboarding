// ─────────────────────────────────────────────────────────────────
// Phase B.2 — Affichage lecture seule du plan d'analyses
// Date : 2026-05-09
//
// Bloc lecture seule a inclure dans la fiche cliente (NutritionConsultation).
// Charge le dernier analysis_plan pour le client_id depuis Supabase.
// Affiche : status, date, tests selectionnes, cout, marge, notes IA.
//
// Pas de modification inline (V4 = simple d'abord). L'edition viendra
// si le besoin est observe sur les pilotes.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const STATUS_LABELS = {
  draft: { label: 'Brouillon', color: '#888' },
  sent: { label: 'Envoye a la cliente', color: '#2d5a3d' },
  in_progress: { label: 'En cours', color: '#856404' },
  completed: { label: 'Termine', color: '#1a4028' },
};

// Phase C (2026-05-10) — workflow Anissa
// Transitions de statut autorisees : draft -> sent -> in_progress -> completed.
// Pas de retour en arriere (V4 = minimal). updated_at gere par trigger BDD.
const NEXT_STATUS = {
  draft: { next: 'sent', label: '✉ Marquer comme envoyé' },
  sent: { next: 'in_progress', label: '📥 Résultats reçus' },
  in_progress: { next: 'completed', label: '✓ Marquer terminé' },
  completed: null,
};

export default function AnalysisPlanCard({ clientId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadLatest() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('analysis_plans')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (err) throw new Error(err.message);
        setPlan(data || null);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Erreur chargement plan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLatest();
    return () => { cancelled = true; };
  }, [clientId]);

  async function advanceStatus() {
    if (!plan) return;
    const transition = NEXT_STATUS[plan.status];
    if (!transition) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const { data, error: err } = await supabase
        .from('analysis_plans')
        .update({ status: transition.next })
        .eq('id', plan.id)
        .select('*')
        .maybeSingle();
      if (err) throw new Error(err.message);
      setPlan(data || null);
    } catch (e) {
      setUpdateError(e?.message || 'Erreur mise à jour');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ color: '#888', fontSize: 13 }}>Chargement du plan d'analyses…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...cardStyle, borderColor: 'rgba(196,68,68,0.3)' }}>
        <div style={{ color: '#c44', fontSize: 13 }}>
          ⚠️ Erreur chargement plan : {error}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={cardStyle}>
        <div style={{ color: '#888', fontSize: 13 }}>
          Aucun plan d'analyses créé pour cette cliente.
        </div>
        <div style={{ color: '#aaa', fontSize: 11, marginTop: 6 }}>
          → Va à l'étape 8 de l'anamnèse pour suggérer un plan via l'IA.
        </div>
      </div>
    );
  }

  const tests = Array.isArray(plan.selected_tests) ? plan.selected_tests : [];
  const status = STATUS_LABELS[plan.status] || STATUS_LABELS.draft;
  const dateStr = plan.created_at
    ? new Date(plan.created_at).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            🧪 Plan d'analyses
          </h3>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            Créé le {dateStr} · {tests.length} {tests.length > 1 ? 'analyses' : 'analyse'}
          </div>
        </div>
        <div style={{
          fontSize: 11,
          padding: '3px 10px',
          borderRadius: 12,
          background: `${status.color}22`,
          color: status.color,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.04em',
        }}>
          {status.label}
        </div>
      </div>

      {tests.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {tests.map((t, i) => (
            <div key={t.code || i} style={testRowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {t.name || t.code}
                </div>
                {t.reason && (
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2, fontStyle: 'italic' }}>
                    {t.reason}
                  </div>
                )}
                {t.category && (
                  <span style={categoryTagStyle}>{t.category}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', marginLeft: 12 }}>
                {t.cost_anissa_chf} CHF
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={summaryRowStyle}>
        <div style={{ fontSize: 11, color: '#888' }}>
          Pack {plan.pack_price_chf} CHF · Coût analyses {plan.total_cost_anissa_chf} CHF
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: plan.total_margin_chf >= 0 ? '#2d5a3d' : '#c44',
        }}>
          💰 Marge {plan.total_margin_chf} CHF
        </div>
      </div>

      {plan.notes_anissa && (
        <div style={notesStyle}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#856404', textTransform: 'uppercase', marginBottom: 4 }}>
            ⚠️ Alertes IA
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>{plan.notes_anissa}</div>
        </div>
      )}

      {/* Phase C : action de transition de statut (Anissa avance le workflow) */}
      {NEXT_STATUS[plan.status] && (
        <div style={actionRowStyle}>
          <button
            type="button"
            onClick={advanceStatus}
            disabled={updating}
            style={{
              ...actionButtonStyle,
              opacity: updating ? 0.6 : 1,
              cursor: updating ? 'wait' : 'pointer',
            }}
          >
            {updating ? '…' : NEXT_STATUS[plan.status].label}
          </button>
          {updateError && (
            <div style={{ fontSize: 11, color: '#c44', marginTop: 6 }}>
              ⚠️ {updateError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles inline ────────────────────────────────────────────────
const cardStyle = {
  background: 'rgba(45,90,61,0.04)',
  border: '1px solid rgba(45,90,61,0.15)',
  borderRadius: 8,
  padding: 14,
  margin: '12px 0',
};
const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};
const testRowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(0,0,0,0.05)',
  borderRadius: 6,
  marginBottom: 4,
};
const categoryTagStyle = {
  display: 'inline-block',
  fontSize: 9,
  padding: '1px 6px',
  background: 'rgba(45,90,61,0.1)',
  color: '#2d5a3d',
  borderRadius: 4,
  marginTop: 4,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
};
const summaryRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px dashed rgba(0,0,0,0.08)',
};
const notesStyle = {
  marginTop: 10,
  padding: 10,
  background: 'rgba(255,193,7,0.08)',
  borderRadius: 6,
  borderLeft: '3px solid #ffc107',
};
const actionRowStyle = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px dashed rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
};
const actionButtonStyle = {
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 14px',
  background: '#2d5a3d',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  letterSpacing: '.02em',
};
