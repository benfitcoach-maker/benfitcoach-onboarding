// ─────────────────────────────────────────────────────────────────
// Phase I — Page Parcours Cliente refondue (Design System V1)
// Date : 2026-05-10
//
// Inspiration UI : Linear, Notion, Stripe Dashboard, Raycast.
// Charte Anissa : vert #1A2E1F en accent + fond ivoire + Playfair italic
// pour les titres premium + Lexend Deca pour body + Inter pour UI.
//
// Toutes les classes CSS vivent dans src/styles/journey.css. Aucun
// inline style metier — uniquement de la composition. Permet de
// retoucher le design sans toucher la logique.
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
import JourneyPlanEditor from './JourneyPlanEditor';
import './styles/journey.css';

export default function ClientJourneyPage({ clientId, onExit, onEditProfile }) {
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

  if (loading) {
    return (
      <div className="jrn-page">
        <div style={{ padding: 60, color: 'var(--jrn-text-muted)', textAlign: 'center', fontFamily: 'var(--jrn-font-body)' }}>
          Chargement du parcours…
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="jrn-page">
        <div style={{ padding: 60, color: 'var(--jrn-error)', textAlign: 'center', fontFamily: 'var(--jrn-font-body)' }}>
          Erreur : {error}
        </div>
      </div>
    );
  }
  if (!client) {
    return (
      <div className="jrn-page">
        <div style={{ padding: 60, color: 'var(--jrn-text-muted)', textAlign: 'center', fontFamily: 'var(--jrn-font-body)' }}>
          Cliente introuvable.
        </div>
      </div>
    );
  }

  const journey = { ...DEFAULT_JOURNEY_STATE, ...(client.journey_state || {}) };
  const pack = PACK_DEFINITIONS[client.packType] || null;
  const prenom = client.prenom || client.form?.prenom || 'Cliente';
  const currentStep = journey.current_step || 'anamnesis';

  const stepStatuses = JOURNEY_STEPS.map((s) => ({ step: s, status: getStepStatus(journey, s) }));
  const completedCount = stepStatuses.filter((s) => s.status === 'validated' || s.status === 'skipped').length;
  const progressPct = Math.round((completedCount / JOURNEY_STEPS.length) * 100);
  const currentStepIndex = STEP_META[currentStep]?.index || 1;

  const refresh = () => loadClient();

  return (
    <div className="jrn-page">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="jrn-header">
        <div className="jrn-header__identity">
          <div>
            <p className="jrn-header__eyebrow">Parcours cliente</p>
            <h1 className="jrn-header__name">{prenom}</h1>
          </div>
          {pack && <span className="jrn-header__pack">{pack.label}</span>}
        </div>

        <div className="jrn-header__progress">
          <div className="jrn-header__progress-meta">
            <span>Étape {currentStepIndex} / {JOURNEY_STEPS.length}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="jrn-header__progress-track">
            <div className="jrn-header__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="jrn-header__actions">
          {currentStepIndex > 1 && (
            <button
              onClick={async () => {
                try {
                  await transitions.goToPreviousStep(client.id, currentStep);
                  refresh();
                } catch (e) { /* silencieux */ }
              }}
              className="jrn-btn jrn-btn--ghost"
              title="Revenir à l'étape précédente"
            >
              ← Étape précédente
            </button>
          )}
          {onEditProfile && (
            <button onClick={onEditProfile} className="jrn-btn jrn-btn--ghost" title="Éditer le profil cliente">
              Profil
            </button>
          )}
          <button onClick={onExit} className="jrn-btn jrn-btn--ghost">
            Dashboard
          </button>
        </div>
      </header>

      {/* ─── Body : sidebar + main ──────────────────────────────── */}
      <div className="jrn-body">
        <aside className="jrn-sidebar">
          <p className="jrn-sidebar__label">Étapes</p>
          {JOURNEY_STEPS.map((step) => {
            const status = getStepStatus(journey, step);
            const meta = STEP_META[step];
            const active = step === currentStep;
            const cls = ['jrn-step'];
            if (active) cls.push('jrn-step--active');
            else if (status === 'validated') cls.push('jrn-step--validated');
            else if (status === 'skipped') cls.push('jrn-step--skipped');
            return (
              <div key={step} className={cls.join(' ')}>
                <span className="jrn-step__num">
                  {status === 'validated' ? '✓' : status === 'skipped' ? '↷' : meta.index}
                </span>
                <span>{meta.label}</span>
              </div>
            );
          })}
          <div className="jrn-sidebar__rule">
            Une seule étape active à la fois. La suivante se débloque automatiquement après validation. L'état est sauvegardé en continu.
          </div>
        </aside>

        <main className="jrn-main">
          {currentStep === 'anamnesis' && <StepAnamnesis client={client} onChange={refresh} />}
          {currentStep === 'analyses' && <StepAnalyses client={client} journey={journey} onChange={refresh} />}
          {currentStep === 'waiting_results' && <StepWaitingResults client={client} onChange={refresh} />}
          {currentStep === 'results' && <StepResults client={client} onChange={refresh} />}
          {currentStep === 'plan_generation' && <StepPlanGeneration client={client} journey={journey} onChange={refresh} />}
          {currentStep === 'plan_editing' && <StepPlanEditing client={client} onChange={refresh} />}
          {currentStep === 'delivery' && <StepDelivery client={client} onChange={refresh} />}
          {currentStep === 'followup' && <StepFollowup client={client} journey={journey} onExit={onExit} />}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPER : header d'étape (eyebrow + title + intro)
// ═══════════════════════════════════════════════════════════════════

function StepHead({ index, title, intro }) {
  return (
    <header style={{ marginBottom: 'var(--jrn-8)' }}>
      <p className="jrn-step-eyebrow">Étape {index} / 8</p>
      <h2 className="jrn-step-title">{title}</h2>
      <p className="jrn-step-intro">{intro}</p>
    </header>
  );
}

function ErrorLine({ msg }) {
  if (!msg) return null;
  return <div className="jrn-error">⚠ {msg}</div>;
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 1 — ANAMNÈSE
// ═══════════════════════════════════════════════════════════════════

function StepAnamnesis({ client, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const form = client.form || {};
  const minimallyFilled = !!(form.objectifs || form.symptomes || form.pathologies || form.activite);

  const handleValidate = async () => {
    if (!minimallyFilled && !window.confirm('L\'anamnèse semble incomplète. Valider quand même ?')) return;
    setBusy(true); setErr(null);
    try {
      await transitions.validateAnamnesis(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur transition'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <StepHead
        index={1}
        title="Anamnèse"
        intro="L'entretien initial est la fondation du parcours. Vérifiez que les informations clés sont bien renseignées avant de poursuivre."
      />

      <div className="jrn-surface">
        <div className="jrn-label">Aperçu de l'anamnèse</div>
        <div className="jrn-kv">
          <div className="jrn-kv__k">Objectifs</div>
          <div className={`jrn-kv__v ${form.objectifs ? '' : 'jrn-kv__v--empty'}`}>{form.objectifs || 'non renseigné'}</div>
          <div className="jrn-kv__k">Symptômes</div>
          <div className={`jrn-kv__v ${form.symptomes ? '' : 'jrn-kv__v--empty'}`}>{form.symptomes || 'non renseigné'}</div>
          <div className="jrn-kv__k">Pathologies</div>
          <div className={`jrn-kv__v ${form.pathologies ? '' : 'jrn-kv__v--empty'}`}>{form.pathologies || 'non renseigné'}</div>
          <div className="jrn-kv__k">Activité</div>
          <div className={`jrn-kv__v ${form.activite ? '' : 'jrn-kv__v--empty'}`}>{form.activite || 'non renseigné'}</div>
        </div>
      </div>

      <div className="jrn-actions">
        <button onClick={handleValidate} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : 'Valider l\'anamnèse'}
        </button>
        <span style={{ fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)' }}>
          L'édition complète se fait via Profil en haut.
        </span>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 2 — ANALYSES
// ═══════════════════════════════════════════════════════════════════

function StepAnalyses({ client, journey, onChange }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const [savePlanError, setSavePlanError] = useState(null);
  const [savingTransition, setSavingTransition] = useState(false);
  const [hasPlan, setHasPlan] = useState(null);

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
    } catch (e) { setSavePlanError(e?.message || 'Erreur'); }
    finally { setSavingTransition(false); }
  };

  const handleSkip = async () => {
    if (!window.confirm('Passer l\'étape Analyses ?\n\nLe parcours saute directement à la génération du plan.')) return;
    setSavingTransition(true);
    try {
      await transitions.skipAnalyses(client.id);
      onChange();
    } catch (e) { setSavePlanError(e?.message || 'Erreur'); }
    finally { setSavingTransition(false); }
  };

  return (
    <section>
      <StepHead
        index={2}
        title="Analyses biologiques"
        intro="Suggestion IA d'analyses pertinentes selon l'anamnèse et le pack acheté. À vous de valider ou d'écarter chaque proposition."
      />

      {hasPlan === null && <div style={{ color: 'var(--jrn-text-muted)' }}>Vérification…</div>}

      {hasPlan === false && (
        <div className="jrn-actions">
          <button onClick={() => setShowSuggest(true)} className="jrn-btn jrn-btn--primary">
            Lancer la suggestion IA
          </button>
          <button onClick={handleSkip} disabled={savingTransition} className="jrn-btn jrn-btn--ghost">
            Passer cette étape
          </button>
        </div>
      )}

      {hasPlan === true && (
        <>
          <AnalysisPlanCard clientId={client.id} />
          <div className="jrn-actions">
            <button onClick={handleValidate} disabled={savingTransition} className="jrn-btn jrn-btn--primary">
              {savingTransition ? '…' : 'Valider et passer en attente résultats'}
            </button>
          </div>
        </>
      )}

      <ErrorLine msg={savePlanError} />

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
// ÉTAPE 3 — ATTENTE RÉSULTATS
// ═══════════════════════════════════════════════════════════════════

function StepWaitingResults({ client, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleReceived = async () => {
    setBusy(true); setErr(null);
    try {
      await transitions.markResultsReceived(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <StepHead
        index={3}
        title="En attente des résultats"
        intro="Les analyses sont chez la cliente ou au laboratoire. Le plan nutritionnel reste verrouillé jusqu'à réception des résultats."
      />

      <AnalysisPlanCard clientId={client.id} />

      <div className="jrn-actions">
        <button onClick={handleReceived} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : 'Marquer les résultats comme reçus'}
        </button>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 4 — SAISIE RÉSULTATS
// ═══════════════════════════════════════════════════════════════════

function StepResults({ client, onChange }) {
  const [synthesis, setSynthesis] = useState(client.journey_state?.results_synthesis || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleValidate = async () => {
    setBusy(true); setErr(null);
    try {
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
    } catch (e) { setErr(e?.message || 'Erreur validation'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <StepHead
        index={4}
        title="Saisie des résultats"
        intro="Synthèse interne pour préparer le plan. Ce texte n'est pas envoyé directement à la cliente."
      />

      <textarea
        value={synthesis}
        onChange={(e) => setSynthesis(e.target.value)}
        rows={12}
        placeholder="Déficits identifiés, axes prioritaires, alertes laboratoire, microbiome…"
        className="jrn-textarea"
      />

      <div className="jrn-actions">
        <button onClick={handleValidate} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : 'Valider et débloquer le plan nutritionnel'}
        </button>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 5 — GÉNÉRATION DU PLAN
// ═══════════════════════════════════════════════════════════════════

function StepPlanGeneration({ client, journey, onChange }) {
  const synthesis = journey?.results_synthesis;
  const skipped = journey?.analyses_skipped;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleMarkGenerated = async () => {
    setBusy(true); setErr(null);
    try {
      await transitions.markPlanGenerated(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur transition'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <StepHead
        index={5}
        title="Génération du plan"
        intro="Le contexte est complet. Marquez cette étape une fois qu'un premier brouillon est en place. L'étape suivante ouvre l'éditeur intégré."
      />

      {(skipped || synthesis) && (
        <div className="jrn-surface">
          {skipped && <div style={{ marginBottom: synthesis ? 'var(--jrn-4)' : 0, color: 'var(--jrn-text-soft)' }}>↷ Étape Analyses passée — pack sans analyses.</div>}
          {synthesis && (
            <>
              <div className="jrn-label">Synthèse résultats Anissa</div>
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--jrn-text)', fontSize: 'var(--jrn-text-sm)' }}>{synthesis}</div>
            </>
          )}
        </div>
      )}

      <div className="jrn-actions">
        <button onClick={handleMarkGenerated} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : 'Plan généré, passer à l\'édition'}
        </button>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 6 — ÉDITION DU PLAN (composer embed)
// ═══════════════════════════════════════════════════════════════════

function StepPlanEditing({ client, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleValidate = async () => {
    if (!window.confirm('Valider le plan ?\n\nLe plan passe en étape Livraison.')) return;
    setBusy(true); setErr(null);
    try {
      await transitions.validatePlan(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur transition'); setBusy(false); }
  };

  return (
    <section>
      <StepHead
        index={6}
        title="Édition du plan"
        intro="Génération IA, édition libre, sauvegarde. Une fois le plan finalisé, validez pour passer à la livraison."
      />

      <JourneyPlanEditor client={client} onPlanSaved={() => {}} />

      <div className="jrn-actions">
        <button onClick={handleValidate} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : 'Valider le plan et passer à la livraison'}
        </button>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 7 — LIVRAISON
// ═══════════════════════════════════════════════════════════════════

function StepDelivery({ client, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleDelivered = async () => {
    setBusy(true); setErr(null);
    try {
      await transitions.markDelivered(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <StepHead
        index={7}
        title="Livraison à la cliente"
        intro="Préparez le plan pour la cliente : export PDF, envoi postal, mise à disposition dans l'app. Marquez cette étape quand le plan est entre ses mains."
      />

      <div className="jrn-surface">
        <div className="jrn-label">Checklist livraison</div>
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--jrn-text-soft)', fontSize: 'var(--jrn-text-sm)', lineHeight: 1.8 }}>
          <li>PDF généré depuis l'éditeur de plan (étape précédente)</li>
          <li>Envoi postal préparé : étiquette + plan imprimé</li>
          <li>Plan poussé sur l'app cliente si activée</li>
        </ul>
      </div>

      <div className="jrn-actions">
        <button onClick={handleDelivered} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : 'Plan livré, passer au suivi'}
        </button>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 8 — SUIVI
// ═══════════════════════════════════════════════════════════════════

function StepFollowup({ client, journey, onExit }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const started = !!journey?.followup_started;

  const handleStart = async () => {
    setBusy(true); setErr(null);
    try {
      await transitions.startFollowup(client.id);
      onExit();
    } catch (e) { setErr(e?.message || 'Erreur'); setBusy(false); }
  };

  return (
    <section>
      <StepHead
        index={8}
        title="Suivi"
        intro="Le plan est livré. Le suivi continue : feedbacks, ajustements, revues de cycle, suivi pack 4 semaines."
      />

      {started ? (
        <div className="jrn-surface jrn-surface--accent">
          ✓ Le suivi est enclenché. Le parcours guidé est officiellement terminé pour cette cliente.
        </div>
      ) : (
        <div className="jrn-actions">
          <button onClick={handleStart} disabled={busy} className="jrn-btn jrn-btn--primary">
            {busy ? '…' : 'Marquer le suivi comme enclenché'}
          </button>
          <button onClick={onExit} className="jrn-btn jrn-btn--ghost">
            Retour dashboard
          </button>
        </div>
      )}
      <ErrorLine msg={err} />
    </section>
  );
}
