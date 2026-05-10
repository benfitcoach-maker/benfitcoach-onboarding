// ─────────────────────────────────────────────────────────────────
// Phase D — Page Parcours Cliente (wizard linaire)
// Date : 2026-05-10
//
// Layout 3 zones :
//   - Header : cliente / pack / statut + bouton Quitter
//   - Sidebar gauche fixe : 4 etapes avec etat (validee/active/locked/skipped)
//   - Centre : contenu de l'etape courante
//
// Une seule etape active a la fois (cf. journeyState.getStepStatus).
// Anissa ne peut pas naviguer librement : elle clique l'etape active,
// fait son travail, valide, l'etape suivante se debloque automatiquement.
//
// Reutilise les composants existants :
//   - AnalysisSuggestionModal (etape 1)
//   - AnalysisPlanCard (etape 2/3 lecture seule du plan en cours)
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { PACK_DEFINITIONS } from './services/packSystem';
import {
  JOURNEY_STEPS,
  STEP_META,
  DEFAULT_JOURNEY_STATE,
  getStepStatus,
  transitions,
} from './services/journeyState';
import AnalysisSuggestionModal from './AnalysisSuggestionModal';
import AnalysisPlanCard from './AnalysisPlanCard';

export default function ClientJourneyPage({ clientId, onExit }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadClient = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setClient(data);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadClient(); }, [loadClient]);

  if (loading) return <div style={layoutStyle}><div style={{ padding: 40 }}>Chargement…</div></div>;
  if (error) return <div style={layoutStyle}><div style={{ padding: 40, color: '#c44' }}>Erreur : {error}</div></div>;
  if (!client) return <div style={layoutStyle}><div style={{ padding: 40 }}>Cliente introuvable.</div></div>;

  const journey = { ...DEFAULT_JOURNEY_STATE, ...(client.journey_state || {}) };
  const pack = PACK_DEFINITIONS[client.packType] || null;
  const prenom = client.prenom || client.form?.prenom || 'Cliente';
  const currentStep = journey.current_step || 'analyses';

  // Apres chaque transition, on relit le client (source de verite).
  const refresh = () => loadClient();

  return (
    <div style={layoutStyle}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Parcours cliente
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 600 }}>
            {prenom}
            {pack && <span style={{ fontSize: 13, color: '#888', fontWeight: 400, marginLeft: 10 }}>· {pack.label}</span>}
          </h1>
        </div>
        <button onClick={onExit} style={exitButtonStyle}>
          ← Retour fiche cliente
        </button>
      </header>

      <div style={contentRowStyle}>
        {/* ─── Sidebar etapes ────────────────────────────────────── */}
        <aside style={sidebarStyle}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Étapes
          </div>
          {JOURNEY_STEPS.map((step) => {
            const status = getStepStatus(journey, step);
            const meta = STEP_META[step];
            return <StepRow key={step} step={step} meta={meta} status={status} active={step === currentStep} />;
          })}

          <div style={{ marginTop: 24, padding: 10, background: 'rgba(0,0,0,0.03)', borderRadius: 6, fontSize: 11, color: '#666', lineHeight: 1.5 }}>
            <strong>Règle :</strong> une étape verrouillée ne s'ouvre qu'après validation de la précédente. Vous pouvez quitter à tout moment, l'état est sauvegardé automatiquement.
          </div>
        </aside>

        {/* ─── Centre : contenu de l'etape courante ──────────────── */}
        <main style={mainStyle}>
          {currentStep === 'analyses' && (
            <StepAnalyses client={client} journey={journey} onChange={refresh} />
          )}
          {currentStep === 'waiting_results' && (
            <StepWaitingResults client={client} onChange={refresh} />
          )}
          {currentStep === 'results' && (
            <StepResults client={client} onChange={refresh} />
          )}
          {currentStep === 'plan' && (
            <StepPlan client={client} journey={journey} onExit={onExit} />
          )}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR ITEM
// ═══════════════════════════════════════════════════════════════════

function StepRow({ step, meta, status, active }) {
  const tone = {
    validated: { bg: 'rgba(45,90,61,0.10)', color: '#1a4028', icon: '✓' },
    active: { bg: '#fff', color: '#2d5a3d', icon: '→' },
    locked: { bg: 'transparent', color: '#aaa', icon: '🔒' },
    skipped: { bg: 'rgba(0,0,0,0.04)', color: '#888', icon: '↷' },
  }[status];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 6,
      background: tone.bg,
      border: active ? '1px solid rgba(45,90,61,0.3)' : '1px solid transparent',
      marginBottom: 6,
      color: tone.color,
    }}>
      <span style={{ fontSize: 13, width: 18, textAlign: 'center' }}>{tone.icon}</span>
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{meta.label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 1 — ANALYSES
// ═══════════════════════════════════════════════════════════════════

function StepAnalyses({ client, journey, onChange }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const [savePlanError, setSavePlanError] = useState(null);
  const [savingTransition, setSavingTransition] = useState(false);
  const [hasPlan, setHasPlan] = useState(null); // null = loading

  // Verifie s'il existe deja un analysis_plan pour cette cliente
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await supabase
        .from('analysis_plans')
        .select('id')
        .eq('client_id', client.id)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setHasPlan(!!data);
    }
    check();
    return () => { cancelled = true; };
  }, [client.id]);

  const handleSavePlan = async (plan) => {
    setSavePlanError(null);
    const { error } = await supabase.from('analysis_plans').insert(plan);
    if (error) {
      setSavePlanError(error.message);
      throw new Error(error.message);
    }
    setHasPlan(true);
  };

  const handleValidate = async () => {
    setSavingTransition(true);
    try {
      await transitions.validateAnalyses(client.id);
      onChange();
    } catch (e) {
      setSavePlanError(e?.message || 'Erreur validation');
    } finally {
      setSavingTransition(false);
    }
  };

  const handleSkip = async () => {
    if (!window.confirm('Passer l\'étape Analyses ?\n\nLa cliente n\'aura pas d\'analyses sanguines. Le parcours saute directement à l\'édition du plan nutritionnel.')) return;
    setSavingTransition(true);
    try {
      await transitions.skipAnalyses(client.id);
      onChange();
    } catch (e) {
      setSavePlanError(e?.message || 'Erreur skip');
    } finally {
      setSavingTransition(false);
    }
  };

  return (
    <section>
      <h2 style={stepTitleStyle}>🧪 Étape 1 — Analyses biologiques</h2>
      <p style={stepIntroStyle}>
        Suggestion IA d'analyses pertinentes selon l'anamnèse et le pack acheté. Anissa décide.
      </p>

      {hasPlan === null && <div style={{ color: '#888' }}>Vérification…</div>}

      {hasPlan === false && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setShowSuggest(true)} style={primaryButtonStyle}>
            ✨ Lancer la suggestion IA
          </button>
          <button onClick={handleSkip} disabled={savingTransition} style={secondaryButtonStyle}>
            ↷ Passer cette étape (pas d'analyses)
          </button>
        </div>
      )}

      {hasPlan === true && (
        <>
          <AnalysisPlanCard clientId={client.id} />
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button onClick={handleValidate} disabled={savingTransition} style={primaryButtonStyle}>
              {savingTransition ? '…' : '✓ Valider et passer en attente résultats'}
            </button>
          </div>
        </>
      )}

      {savePlanError && (
        <div style={{ marginTop: 12, color: '#c44', fontSize: 12 }}>⚠️ {savePlanError}</div>
      )}

      <AnalysisSuggestionModal
        isOpen={showSuggest}
        client={client}
        packType={client.packType}
        onClose={() => setShowSuggest(false)}
        onValidate={async (plan) => {
          await handleSavePlan(plan);
          setShowSuggest(false);
        }}
      />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 2 — ATTENTE RÉSULTATS
// ═══════════════════════════════════════════════════════════════════

function StepWaitingResults({ client, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleReceived = async () => {
    setBusy(true);
    setErr(null);
    try {
      await transitions.markResultsReceived(client.id);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur transition');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 style={stepTitleStyle}>⏳ Étape 2 — En attente des résultats</h2>
      <p style={stepIntroStyle}>
        Les analyses sont chez la cliente / au laboratoire. Pendant ce temps, le plan nutritionnel reste verrouillé. Cliquez ci-dessous quand les résultats sont reçus.
      </p>

      <AnalysisPlanCard clientId={client.id} />

      <div style={{ marginTop: 20 }}>
        <button onClick={handleReceived} disabled={busy} style={primaryButtonStyle}>
          {busy ? '…' : '📥 Marquer les résultats comme reçus'}
        </button>
      </div>
      {err && <div style={{ marginTop: 12, color: '#c44', fontSize: 12 }}>⚠️ {err}</div>}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 3 — SAISIE RÉSULTATS (MVP : juste synthèse Anissa)
// ═══════════════════════════════════════════════════════════════════

function StepResults({ client, onChange }) {
  const [synthesis, setSynthesis] = useState(client.results_synthesis || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleValidate = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Persiste la synthese sur le client (champ libre, pas de colonne dediee
      // pour MVP — on utilise journey_state.results_synthesis)
      const { error: updErr } = await supabase
        .from('clients')
        .update({
          journey_state: {
            ...(client.journey_state || {}),
            results_synthesis: synthesis,
          },
        })
        .eq('id', client.id);
      if (updErr) throw new Error(updErr.message);
      await transitions.validateResults(client.id);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur validation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 style={stepTitleStyle}>📥 Étape 3 — Saisie des résultats</h2>
      <p style={stepIntroStyle}>
        Synthèse interne des résultats analysés. Ce texte vous sert pour préparer le plan, il n'est pas envoyé à la cliente directement.
      </p>

      <textarea
        value={synthesis}
        onChange={(e) => setSynthesis(e.target.value)}
        rows={12}
        placeholder="Synthèse Anissa : déficits identifiés, axes prioritaires, alertes laboratoire, microbiome, etc."
        style={textareaStyle}
      />

      <div style={{ marginTop: 16 }}>
        <button onClick={handleValidate} disabled={busy} style={primaryButtonStyle}>
          {busy ? '…' : '✓ Valider et débloquer le plan nutritionnel'}
        </button>
      </div>
      {err && <div style={{ marginTop: 12, color: '#c44', fontSize: 12 }}>⚠️ {err}</div>}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 4 — PLAN NUTRITIONNEL
// ═══════════════════════════════════════════════════════════════════

function StepPlan({ client, journey, onExit }) {
  const synthesis = journey?.results_synthesis;
  const skipped = journey?.analyses_skipped;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleMarkGenerated = async () => {
    if (!window.confirm('Marquer le plan comme généré ?\n\nCela débloque l\'éditeur classique sur la fiche cliente (composer / cockpit / onglets). Le parcours guidé sera considéré comme terminé.')) return;
    setBusy(true);
    setErr(null);
    try {
      await transitions.markPlanGenerated(client.id);
      onExit(); // retour fiche cliente, qui basculera en mode classique
    } catch (e) {
      setErr(e?.message || 'Erreur transition');
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 style={stepTitleStyle}>🥗 Étape 4 — Plan nutritionnel</h2>
      <p style={stepIntroStyle}>
        Le parcours préparatoire est complet. Quand vous êtes prête à éditer le plan, débloquez l'éditeur classique ci-dessous.
      </p>

      {skipped && (
        <div style={infoBoxStyle}>
          ↷ Étape Analyses passée (pack sans analyses).
        </div>
      )}

      {synthesis && (
        <div style={infoBoxStyle}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', marginBottom: 6 }}>
            Synthèse résultats Anissa
          </div>
          <div style={{ fontSize: 13, color: '#444', whiteSpace: 'pre-wrap' }}>{synthesis}</div>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={handleMarkGenerated} disabled={busy} style={primaryButtonStyle}>
          {busy ? '…' : '✓ Débloquer l\'éditeur classique sur la fiche cliente'}
        </button>
        <button onClick={onExit} style={{ ...primaryButtonStyle, background: 'transparent', color: '#666', border: '1px solid rgba(0,0,0,0.2)' }}>
          ← Retour sans débloquer
        </button>
      </div>
      {err && <div style={{ marginTop: 12, color: '#c44', fontSize: 12 }}>⚠️ {err}</div>}
      <p style={{ fontSize: 12, color: '#888', marginTop: 12 }}>
        Tant que vous ne débloquez pas, la fiche cliente reste en mode parcours minimal (sans composer ni cockpit).
      </p>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const layoutStyle = {
  minHeight: '100vh',
  background: '#f9f7f3',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};
const headerStyle = {
  background: '#fff',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  padding: '18px 32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const exitButtonStyle = {
  background: 'transparent',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 13,
  cursor: 'pointer',
  color: '#444',
};
const contentRowStyle = {
  display: 'grid',
  gridTemplateColumns: '260px 1fr',
  gap: 0,
  alignItems: 'start',
};
const sidebarStyle = {
  padding: '24px 18px',
  borderRight: '1px solid rgba(0,0,0,0.08)',
  background: '#fcfaf6',
  minHeight: 'calc(100vh - 71px)',
};
const mainStyle = {
  padding: '32px 40px',
  maxWidth: 820,
};
const stepTitleStyle = {
  margin: '0 0 8px',
  fontSize: 22,
  fontWeight: 600,
  color: '#1a4028',
};
const stepIntroStyle = {
  margin: '0 0 24px',
  fontSize: 14,
  color: '#666',
  lineHeight: 1.6,
};
const primaryButtonStyle = {
  background: '#2d5a3d',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '12px 20px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '.02em',
};
const secondaryButtonStyle = {
  background: 'transparent',
  color: '#666',
  border: '1px solid rgba(0,0,0,0.2)',
  borderRadius: 6,
  padding: '12px 20px',
  fontSize: 13,
  cursor: 'pointer',
};
const textareaStyle = {
  width: '100%',
  padding: 12,
  fontSize: 13,
  fontFamily: 'inherit',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 6,
  resize: 'vertical',
  background: '#fff',
};
const infoBoxStyle = {
  marginTop: 12,
  padding: 14,
  background: 'rgba(45,90,61,0.05)',
  border: '1px solid rgba(45,90,61,0.15)',
  borderRadius: 6,
};
