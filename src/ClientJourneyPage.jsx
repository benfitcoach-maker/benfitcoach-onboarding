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
import ClientAppPreviewModal from './ClientAppPreviewModal';
import JourneyMessagesPanel from './JourneyMessagesPanel';
import { getNutritionConsultations } from './store';
import './styles/journey.css';

export default function ClientJourneyPage({ clientId, onExit, onEditProfile }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Phase T : aperçu app cliente (modal mockup téléphone)
  const [showAppPreview, setShowAppPreview] = useState(false);
  const [previewConsultation, setPreviewConsultation] = useState(null);
  // Phase AC : panel latéral messagerie SaaS ↔ cliente
  const [showMessages, setShowMessages] = useState(false);

  const openAppPreview = useCallback(async () => {
    if (!clientId) return;
    // Recup la derniere consultation : local store puis fallback Supabase
    let consult = (getNutritionConsultations(clientId) || [])[0] || null;
    if (!consult) {
      const { data } = await supabase
        .from('nutrition_consultations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        consult = {
          clientId,
          nutritionPlan: data.nutrition_plan || data.plan_text || '',
          ficheFrigoJson: data.fiche_frigo_json || null,
          aiDirectives: data.ai_directives || '',
          createdAt: data.created_at,
        };
      }
    }
    setPreviewConsultation(consult || { clientId, nutritionPlan: '', date: new Date().toISOString() });
    setShowAppPreview(true);
  }, [clientId]);

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

  // Phase AJ : compteur consultations utilisées vs incluses dans le pack
  const consultationsTotal = pack?.consultations || 0;
  const consultationsLog = Array.isArray(journey?.consultations_log) ? journey.consultations_log : [];
  const consultationsUsed = consultationsLog.length;

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
          {consultationsTotal > 0 && (
            <span
              className="jrn-header__consult"
              title={`${consultationsUsed} consultation${consultationsUsed > 1 ? 's' : ''} effectuée${consultationsUsed > 1 ? 's' : ''} sur ${consultationsTotal} incluse${consultationsTotal > 1 ? 's' : ''} dans le pack`}
            >
              📅 {consultationsUsed}/{consultationsTotal}
            </span>
          )}
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
          <button
            onClick={() => setShowMessages(true)}
            className="jrn-btn jrn-btn--soft"
            title="Messages avec la cliente + ressentis reçus"
          >
            💬 Messages
          </button>
          <button
            onClick={openAppPreview}
            className="jrn-btn jrn-btn--soft"
            title="Aperçu de ce que la cliente voit dans l'app"
          >
            📱 Aperçu app
          </button>
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

        {/* Phase T : Modal Aperçu app cliente (mockup mobile + publish) */}
        {showAppPreview && previewConsultation && (
          <ClientAppPreviewModal
            client={client}
            consultation={previewConsultation}
            onClose={() => setShowAppPreview(false)}
          />
        )}

        {/* Phase AC : Panel messagerie SaaS ↔ cliente (slide-in droite) */}
        {showMessages && (
          <JourneyMessagesPanel
            client={client}
            onClose={() => setShowMessages(false)}
          />
        )}

        <main className="jrn-main">
          {currentStep === 'anamnesis' && <StepAnamnesis client={client} onChange={refresh} />}
          {currentStep === 'analyses' && <StepAnalyses client={client} journey={journey} onChange={refresh} />}
          {currentStep === 'waiting_results' && <StepWaitingResults client={client} onChange={refresh} />}
          {currentStep === 'results' && <StepResults client={client} onChange={refresh} />}
          {currentStep === 'plan_generation' && <StepPlanGeneration client={client} journey={journey} onChange={refresh} />}
          {currentStep === 'plan_editing' && <StepPlanEditing client={client} onChange={refresh} />}
          {currentStep === 'delivery' && <StepDelivery client={client} onChange={refresh} />}
          {currentStep === 'followup' && <StepFollowup client={client} journey={journey} onChange={refresh} onExit={onExit} />}
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
  // Init data depuis journey_state.results_data, fallback sur l'ancien field results_synthesis
  const initialData = client.journey_state?.results_data || {
    from_plan: [],
    external: [],
    global_synthesis: client.journey_state?.results_synthesis || '',
  };
  const [resultsByTest, setResultsByTest] = useState(initialData.from_plan || []);
  const [externalAnalyses, setExternalAnalyses] = useState(initialData.external || []);
  const [globalSynthesis, setGlobalSynthesis] = useState(initialData.global_synthesis || '');

  const [planTests, setPlanTests] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Charge le analysis_plan de la cliente pour pre-remplir les cartes par test
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('analysis_plans')
        .select('selected_tests')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const tests = Array.isArray(data?.selected_tests) ? data.selected_tests : [];
      setPlanTests(tests);
      // Merge : on garde les valeurs deja saisies, on ajoute les tests du plan absents
      setResultsByTest((prev) => {
        const map = new Map(prev.map((r) => [r.test_code || r.test_name, r]));
        const merged = tests.map((t) => {
          const key = t.code || t.name;
          return map.get(key) || {
            test_code: t.code,
            test_name: t.name || t.code,
            value: '',
            synthesis: '',
          };
        });
        return merged;
      });
    }
    load();
    return () => { cancelled = true; };
  }, [client.id]);

  const updateTestField = (idx, field, value) => {
    setResultsByTest((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const addExternal = () => {
    setExternalAnalyses((prev) => [...prev, { name: '', value: '', synthesis: '' }]);
  };
  const updateExternal = (idx, field, value) => {
    setExternalAnalyses((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const removeExternal = (idx) => {
    setExternalAnalyses((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleValidate = async () => {
    setBusy(true); setErr(null);
    try {
      const { error: updErr } = await supabase
        .from('clients')
        .update({
          journey_state: {
            ...(client.journey_state || {}),
            results_data: {
              from_plan: resultsByTest,
              external: externalAnalyses,
              global_synthesis: globalSynthesis,
            },
            // Backward compat : on garde results_synthesis pour les vieilles vues
            results_synthesis: globalSynthesis,
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
        intro="Saisissez les résultats de chaque analyse demandée et ajoutez les analyses que la cliente possédait déjà. Synthèse globale en bas pour préparer le plan."
      />

      {/* ─── Tests du plan d'analyses ─────────────────────────── */}
      {planTests && planTests.length > 0 && (
        <div style={{ marginBottom: 'var(--jrn-8)' }}>
          <p className="jrn-label" style={{ marginBottom: 'var(--jrn-3)' }}>
            Analyses prescrites ({planTests.length})
          </p>
          <div className="jpe-sections">
            {resultsByTest.map((r, i) => (
              <ResultCard
                key={r.test_code || i}
                title={r.test_name}
                badge="Plan d'analyses"
                badgeColor="accent"
                value={r.value}
                synthesis={r.synthesis}
                onValueChange={(v) => updateTestField(i, 'value', v)}
                onSynthesisChange={(v) => updateTestField(i, 'synthesis', v)}
              />
            ))}
          </div>
        </div>
      )}

      {planTests && planTests.length === 0 && (
        <div className="jrn-surface jrn-surface--quiet" style={{ marginBottom: 'var(--jrn-6)', textAlign: 'center', padding: 'var(--jrn-6)' }}>
          <p style={{ margin: 0, color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>
            Pas d'analyses prescrites pour cette cliente. Vous pouvez tout de même saisir des analyses externes ci-dessous.
          </p>
        </div>
      )}

      {/* ─── Analyses externes (que la cliente avait deja) ─────── */}
      <div style={{ marginBottom: 'var(--jrn-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--jrn-3)' }}>
          <p className="jrn-label" style={{ margin: 0 }}>
            Analyses externes ({externalAnalyses.length})
          </p>
          <button onClick={addExternal} className="jrn-btn jrn-btn--soft">
            + Ajouter une analyse
          </button>
        </div>
        {externalAnalyses.length === 0 && (
          <div className="jrn-surface jrn-surface--quiet" style={{ textAlign: 'center', padding: 'var(--jrn-5)' }}>
            <p style={{ margin: 0, color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>
              Aucune analyse externe ajoutée. Si la cliente possédait déjà des résultats avant le suivi, cliquez sur "+ Ajouter une analyse".
            </p>
          </div>
        )}
        <div className="jpe-sections">
          {externalAnalyses.map((r, i) => (
            <ResultCard
              key={i}
              editable
              title={r.name}
              badge="Externe"
              badgeColor="muted"
              value={r.value}
              synthesis={r.synthesis}
              onTitleChange={(v) => updateExternal(i, 'name', v)}
              onValueChange={(v) => updateExternal(i, 'value', v)}
              onSynthesisChange={(v) => updateExternal(i, 'synthesis', v)}
              onDelete={() => removeExternal(i)}
            />
          ))}
        </div>
      </div>

      {/* ─── Synthese globale ─────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--jrn-6)' }}>
        <p className="jrn-label">Synthèse globale Anissa</p>
        <p style={{ fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)', marginTop: 0, marginBottom: 'var(--jrn-3)' }}>
          Vue d'ensemble : déficits identifiés, axes prioritaires, alertes croisées entre analyses. Sera injectée dans le prompt IA de génération du plan.
        </p>
        <textarea
          value={globalSynthesis}
          onChange={(e) => setGlobalSynthesis(e.target.value)}
          rows={8}
          placeholder="Ex: Carence en B12 confirmée, microbiome déséquilibré (faible diversité), inflammation latente. Prioriser anti-inflammatoire + soutien microbiote, supplémentation B12 méthylée…"
          className="jrn-textarea"
        />
      </div>

      <div className="jrn-actions">
        <button onClick={handleValidate} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : 'Valider et débloquer le plan nutritionnel'}
        </button>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// Carte d'une analyse (du plan ou externe)
function ResultCard({ title, badge, badgeColor, value, synthesis, onValueChange, onSynthesisChange, editable, onTitleChange, onDelete }) {
  const badgeStyle = badgeColor === 'accent'
    ? { background: 'var(--jrn-accent-soft)', color: 'var(--jrn-accent)' }
    : { background: 'rgba(0,0,0,0.05)', color: 'var(--jrn-text-muted)' };

  return (
    <div className="jpe-section">
      <header className="jpe-section__head">
        {editable ? (
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="jpe-section__title"
            placeholder="Nom de l'analyse"
          />
        ) : (
          <span className="jpe-section__title" style={{ borderBottom: 'none', cursor: 'default' }}>{title}</span>
        )}
        <span style={{ ...badgeStyle, fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
          {badge}
        </span>
        {onDelete && (
          <button onClick={onDelete} className="jpe-section__icon-btn jpe-section__icon-btn--danger" title="Supprimer">🗑</button>
        )}
      </header>
      <div style={{ padding: 'var(--jrn-4) var(--jrn-5)', display: 'grid', gap: 'var(--jrn-3)' }}>
        <div>
          <label className="jrn-label">Valeur(s) / Résultat brut</label>
          <textarea
            value={value || ''}
            onChange={(e) => onValueChange(e.target.value)}
            rows={2}
            className="jrn-textarea"
            placeholder="Ex: B12 = 1200 pg/mL (norme 200-900), Vit D = 18 ng/mL…"
            style={{ fontSize: 'var(--jrn-text-sm)' }}
          />
        </div>
        <div>
          <label className="jrn-label">Notes Anissa (interprétation, alertes)</label>
          <textarea
            value={synthesis || ''}
            onChange={(e) => onSynthesisChange(e.target.value)}
            rows={3}
            className="jrn-textarea"
            placeholder="Ex: B12 surdosée, surveiller. Vit D déficitaire → supplémentation prioritaire 4000 UI/j."
            style={{ fontSize: 'var(--jrn-text-sm)' }}
          />
        </div>
      </div>
    </div>
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
  const [exporting, setExporting] = useState(false);
  const [versionsCount, setVersionsCount] = useState(0);
  const [includePaper, setIncludePaper] = useState(true); // par défaut on demande
  const [paperExported, setPaperExported] = useState(false);

  // Charge le nombre de versions pour décider le défaut du toggle
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { getNutritionConsultations } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        if (cancelled) return;
        setVersionsCount(list.length);
        // Par défaut : papier ON pour version 1 (premier cycle = livret fondateur),
        // OFF pour les versions suivantes (ajustements = app uniquement).
        if (list.length > 1) setIncludePaper(false);
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [client?.id]);

  const isFirstVersion = versionsCount <= 1;

  const handleExportWord = async () => {
    setExporting(true);
    setErr(null);
    try {
      const [{ exportPlanToWord }, { getNutritionConsultations }] = await Promise.all([
        import('./services/exportToWord'),
        import('./store'),
      ]);
      const consultations = getNutritionConsultations(client.id) || [];
      const last = consultations[0];
      if (!last) throw new Error('Aucune consultation à exporter');
      await exportPlanToWord(client, last, last.nutritionPlan || '');
      setPaperExported(true);
    } catch (e) {
      setErr(e?.message || 'Erreur export Word');
    } finally {
      setExporting(false);
    }
  };

  const handleDelivered = async () => {
    setBusy(true); setErr(null);
    try {
      // Tag la consultation avec paperGenerated pour l'historique étape 8
      if (includePaper) {
        const { getNutritionConsultations, saveNutritionConsultation } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        const last = list[0];
        if (last) {
          await saveNutritionConsultation({ ...last, paperGenerated: true });
        }
      }
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
        intro={isFirstVersion
          ? 'Premier cycle : livret papier premium + activation app cliente. Le \"waouh effect\" est important — la cliente reçoit quelque chose de tangible.'
          : 'Adaptation depuis le cycle précédent. Par défaut, on publie uniquement sur l\'app (pas de spam postal). Cochez ci-dessous pour générer aussi un nouveau document papier si le changement est majeur.'}
      />

      {/* ─── Toggle papier ─────────────────────────────────────── */}
      <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includePaper}
            onChange={(e) => setIncludePaper(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--jrn-accent)' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--jrn-text)' }}>
              📦 Plan papier nécessaire pour ce cycle
            </div>
            <div style={{ fontSize: 12, color: 'var(--jrn-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              {isFirstVersion
                ? 'Recommandé pour le premier cycle : livret fondateur premium qui ancre l\'expérience.'
                : 'À cocher uniquement pour les changements majeurs : nouveau cycle 4 semaines, refonte protocole, nouvelle phase (postpartum, sèche, etc.).'}
            </div>
          </div>
        </label>
      </div>

      {/* ─── Section app cliente (toujours présente) ─────────────── */}
      <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)' }}>
        <div className="jrn-label">📱 App cliente</div>
        <p style={{ fontSize: 13, color: 'var(--jrn-text-soft)', marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
          Le plan sera disponible sur l'app dès la publication. La cliente reçoit une notification.
        </p>
        <p style={{ fontSize: 12, color: 'var(--jrn-text-muted)', margin: 0 }}>
          → Cliquez sur <strong>📱 Aperçu app</strong> en haut à droite pour visualiser et publier.
        </p>
      </div>

      {/* ─── Section papier (conditionnelle) ──────────────────────── */}
      {includePaper && (
        <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)' }}>
          <div className="jrn-label">📦 Plan papier</div>
          <ul style={{ margin: '8px 0 12px', paddingLeft: 20, color: 'var(--jrn-text-soft)', fontSize: 13, lineHeight: 1.8 }}>
            <li>Générer le document Word depuis l'éditeur de plan</li>
            <li>Imprimer (recto-verso recommandé)</li>
            <li>Préparer enveloppe + étiquette adresse cliente</li>
            <li>Envoi postal</li>
          </ul>
          <div className="jrn-actions" style={{ marginTop: 0 }}>
            <button onClick={handleExportWord} disabled={exporting} className="jrn-btn jrn-btn--soft">
              {exporting ? 'Export…' : (paperExported ? '✓ Word téléchargé — Re-télécharger' : '📥 Exporter Word')}
            </button>
          </div>
        </div>
      )}

      <div className="jrn-actions">
        <button onClick={handleDelivered} disabled={busy} className="jrn-btn jrn-btn--primary">
          {busy ? '…' : (includePaper ? 'Plan livré (papier + app), passer au suivi' : 'Plan publié sur app, passer au suivi')}
        </button>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 8 — SUIVI
// ═══════════════════════════════════════════════════════════════════

function StepFollowup({ client, journey, onChange, onExit }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loadingFb, setLoadingFb] = useState(true);
  const [adapting, setAdapting] = useState(false);
  const [versions, setVersions] = useState([]);
  const [previewVersion, setPreviewVersion] = useState(null);
  const started = !!journey?.followup_started;

  // Phase AJ : log des consultations effectuees
  const pack = PACK_DEFINITIONS[client.packType] || null;
  const consultationsTotal = pack?.consultations || 0;
  const consultationsLog = Array.isArray(journey?.consultations_log) ? journey.consultations_log : [];
  const consultationsUsed = consultationsLog.length;
  const [showLogModal, setShowLogModal] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  const handleLogConsultation = async () => {
    setSavingLog(true);
    setErr(null);
    try {
      await transitions.logConsultation(client.id, { notes: logNote });
      setLogNote('');
      setShowLogModal(false);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur enregistrement consultation');
    } finally {
      setSavingLog(false);
    }
  };

  const handleRemoveLastConsultation = async () => {
    if (!window.confirm('Annuler la dernière consultation enregistrée ?\n\nCette action retire la dernière entrée du journal des consultations (utile en cas de clic accidentel).')) return;
    setBusy(true);
    setErr(null);
    try {
      await transitions.removeLastConsultation(client.id);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur annulation');
    } finally {
      setBusy(false);
    }
  };

  // Charge l'historique des versions du plan
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { getNutritionConsultations } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        if (cancelled) return;
        setVersions(list);
      } catch {
        if (!cancelled) setVersions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [client?.id, journey]);

  // Charge les ressentis recents (14 jours)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { fetchClientFeedbacks } = await import('./services/fetchClientFeedbacks');
        const res = await fetchClientFeedbacks(client, 14);
        if (cancelled) return;
        setFeedbacks(Array.isArray(res) ? res : (res?.feedbacks || []));
      } catch {
        if (!cancelled) setFeedbacks([]);
      } finally {
        if (!cancelled) setLoadingFb(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [client]);

  const handleStart = async () => {
    setBusy(true); setErr(null);
    try {
      await transitions.startFollowup(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur'); }
    finally { setBusy(false); }
  };

  const handleRestartEditing = async () => {
    setBusy(true); setErr(null);
    try {
      await transitions.restartPlanEditing(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur'); setBusy(false); }
  };

  const handleAdaptFromFeedback = async () => {
    if (feedbacks.length === 0) {
      setErr('Aucun ressenti à exploiter pour adapter le plan.');
      return;
    }
    if (!window.confirm('Adapter le plan à partir des ressentis cliente ?\n\nL\'IA va générer une nouvelle version du plan en tenant compte des derniers retours. Vous serez ensuite redirigée vers l\'éditeur étape 6 pour relire et publier.')) return;
    setAdapting(true);
    setErr(null);
    try {
      const [{ adaptPlanFromReview }, { getNutritionConsultations, saveNutritionConsultation }] = await Promise.all([
        import('./services/aiPlanOptimizer'),
        import('./store'),
      ]);
      const consultations = getNutritionConsultations(client.id) || [];
      const lastConsult = consultations[0];
      const currentPlan = lastConsult?.nutritionPlan || '';
      if (!currentPlan) throw new Error('Pas de plan actuel à adapter');

      // review = synthèse rapide des ressentis pour l'IA
      const reviewText = feedbacks.slice(0, 7).map((f, i) => {
        const date = f.created_at ? new Date(f.created_at).toLocaleDateString('fr-CH') : '';
        const body = f.body || f.text || f.message || '';
        return `[${date}] ${body}`;
      }).join('\n\n');

      const adaptedPlan = await adaptPlanFromReview(client.form || {}, currentPlan, reviewText, '');
      if (!adaptedPlan) throw new Error('Adaptation IA vide');

      // Sauve comme NOUVELLE version (insert, ne touche pas l'ancienne).
      // Le plan actuel devient automatiquement archivé (puisqu'une version
      // plus récente existe). La cliente verra uniquement la version active
      // (la plus récente) à sa prochaine connexion via publishConsultationToClientApp.
      const today = new Date();
      const dateStr = today.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: '2-digit' });
      const versionNum = (versions.length + 1);
      await saveNutritionConsultation({
        clientId: client.id,
        nutritionPlan: adaptedPlan,
        createdAt: today.toISOString(),
        status: 'a_valider',
        label: `V${versionNum} — Adaptation depuis ressentis du ${dateStr}`,
        consultantName: 'Anissa',
        adaptedFrom: lastConsult?.id || null,
        feedbacksCount: feedbacks.length,
      });

      // Bascule en mode edition pour qu'Anissa relise
      await transitions.restartPlanEditing(client.id);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur adaptation IA');
    } finally {
      setAdapting(false);
    }
  };

  return (
    <section>
      <StepHead
        index={8}
        title="Suivi continu"
        intro="Le plan est livré. Vous suivez l'évolution de la cliente, adaptez son plan à partir de ses ressentis, et republiez à chaque cycle."
      />

      {!started && (
        <div className="jrn-surface jrn-surface--quiet" style={{ marginBottom: 'var(--jrn-6)' }}>
          <p style={{ margin: 0, fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)' }}>
            Le parcours initial est complet. Marquez le suivi comme enclenché pour activer ce cockpit.
          </p>
          <div className="jrn-actions" style={{ marginTop: 'var(--jrn-3)' }}>
            <button onClick={handleStart} disabled={busy} className="jrn-btn jrn-btn--primary">
              {busy ? '…' : 'Activer le suivi continu'}
            </button>
          </div>
        </div>
      )}

      {started && (
        <>
          {/* ─── Section : Consultations effectuées ─────────────── */}
          <div style={{ marginBottom: 'var(--jrn-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--jrn-3)' }}>
              <p className="jrn-label" style={{ margin: 0 }}>
                Consultations {consultationsTotal > 0 ? `(${consultationsUsed}/${consultationsTotal})` : `(${consultationsUsed})`}
              </p>
              <button
                onClick={() => setShowLogModal(true)}
                disabled={consultationsTotal > 0 && consultationsUsed >= consultationsTotal}
                className="jrn-btn jrn-btn--primary"
                style={{ padding: '6px 14px', fontSize: 12 }}
                title={consultationsTotal > 0 && consultationsUsed >= consultationsTotal ? 'Quota du pack atteint' : 'Marquer une nouvelle consultation effectuée'}
              >
                ✅ Consultation effectuée
              </button>
            </div>

            {consultationsLog.length === 0 && (
              <div className="jrn-surface jrn-surface--quiet" style={{ padding: 'var(--jrn-5)', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>
                  Aucune consultation enregistrée pour l'instant. Cliquez sur <strong>✅ Consultation effectuée</strong> après chaque RDV (cabinet ou visio).
                </p>
              </div>
            )}

            {consultationsLog.length > 0 && (
              <div className="jrn-surface" style={{ padding: 0, overflow: 'hidden' }}>
                {[...consultationsLog].reverse().map((c, i) => {
                  const date = c.date ? new Date(c.date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
                  const num = consultationsLog.length - i;
                  const isLast = i === 0;
                  return (
                    <div
                      key={`${c.date}-${i}`}
                      style={{
                        padding: '12px 16px',
                        borderBottom: i < consultationsLog.length - 1 ? '1px solid var(--jrn-border)' : 'none',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <span style={{
                        flexShrink: 0,
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: 'var(--jrn-accent-soft)',
                        color: 'var(--jrn-accent)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        marginTop: 1,
                      }}>{num}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--jrn-text)', fontWeight: 500 }}>{date}</div>
                        {c.notes && (
                          <div style={{ fontSize: 12, color: 'var(--jrn-text-soft)', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{c.notes}</div>
                        )}
                      </div>
                      {isLast && (
                        <button
                          onClick={handleRemoveLastConsultation}
                          disabled={busy}
                          className="jrn-btn jrn-btn--ghost"
                          style={{ padding: '4px 8px', fontSize: 11, color: 'var(--jrn-text-muted)' }}
                          title="Annuler la dernière consultation enregistrée (clic accidentel)"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {consultationsTotal > 0 && consultationsUsed >= consultationsTotal && (
              <p style={{ marginTop: 'var(--jrn-2)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-warn)' }}>
                ⓘ Quota du pack atteint ({consultationsTotal} consultation{consultationsTotal > 1 ? 's' : ''}). Pour facturer une consultation supplémentaire, créez un nouveau pack ou ajustez le pack actuel.
              </p>
            )}
          </div>

          {/* ─── Section : derniers ressentis ──────────────────── */}
          <div style={{ marginBottom: 'var(--jrn-6)' }}>
            <p className="jrn-label">Derniers ressentis ({feedbacks.length})</p>
            {loadingFb && <div style={{ color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>Chargement…</div>}
            {!loadingFb && feedbacks.length === 0 && (
              <div className="jrn-surface jrn-surface--quiet" style={{ padding: 'var(--jrn-5)', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>
                  Aucun ressenti reçu sur les 14 derniers jours.
                </p>
              </div>
            )}
            {!loadingFb && feedbacks.length > 0 && (
              <div className="jrn-surface" style={{ padding: 0, overflow: 'hidden' }}>
                {feedbacks.slice(0, 5).map((f, i) => (
                  <div key={f.id || i} style={{ padding: '12px 16px', borderBottom: i < Math.min(4, feedbacks.length - 1) ? '1px solid var(--jrn-border)' : 'none' }}>
                    <div style={{ fontSize: 10, color: 'var(--jrn-text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' }) : ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--jrn-text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {f.body || f.text || f.message || JSON.stringify(f)}
                    </div>
                  </div>
                ))}
                {feedbacks.length > 5 && (
                  <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--jrn-text-muted)', textAlign: 'center', background: 'var(--jrn-surface-alt)' }}>
                    + {feedbacks.length - 5} autres dans le panel Messages
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Section : actions de cycle ─────────────────────── */}
          <div style={{ marginBottom: 'var(--jrn-6)' }}>
            <p className="jrn-label">Cycle de suivi</p>
            <div className="jrn-actions">
              <button
                onClick={handleAdaptFromFeedback}
                disabled={adapting || feedbacks.length === 0}
                className="jrn-btn jrn-btn--primary"
                title="L'IA adapte le plan en tenant compte des derniers ressentis cliente"
              >
                {adapting ? 'Adaptation IA…' : '✨ Adapter le plan depuis les ressentis'}
              </button>
              <button onClick={handleRestartEditing} disabled={busy} className="jrn-btn jrn-btn--soft">
                Éditer le plan manuellement
              </button>
            </div>
            <p style={{ marginTop: 'var(--jrn-2)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)' }}>
              Cycle : Adapter → Éditer (étape 6) → Republier (étape 7) → retour ici.
            </p>
          </div>

          {/* ─── Section : historique des versions ──────────────── */}
          {versions.length > 0 && (
            <div style={{ marginBottom: 'var(--jrn-6)' }}>
              <p className="jrn-label">Historique des versions du plan ({versions.length})</p>
              <div className="jrn-surface" style={{ padding: 0, overflow: 'hidden' }}>
                {versions.map((v, i) => {
                  const isActive = i === 0;
                  const date = v.createdAt ? new Date(v.createdAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                  const label = v.label || (i === versions.length - 1 ? 'Plan initial' : 'Plan');
                  const hasPaper = !!v.paperGenerated;
                  return (
                    <div
                      key={v.id || i}
                      style={{
                        padding: '12px 16px',
                        borderBottom: i < versions.length - 1 ? '1px solid var(--jrn-border)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: isActive ? 'var(--jrn-accent-soft)' : 'transparent',
                      }}
                    >
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: isActive ? 'var(--jrn-accent)' : 'rgba(0,0,0,0.06)',
                        color: isActive ? 'var(--jrn-surface)' : 'var(--jrn-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '.04em',
                        whiteSpace: 'nowrap',
                      }}>
                        {isActive ? '● Active' : 'Archivée'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--jrn-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {label}
                          {hasPaper && (
                            <span title="Version envoyée en papier" style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(184, 134, 38, 0.12)',
                              color: '#8a6722',
                              fontWeight: 600,
                              letterSpacing: '.02em',
                            }}>
                              📦 Papier
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--jrn-text-muted)', marginTop: 2 }}>{date}</div>
                      </div>
                      <button
                        onClick={() => setPreviewVersion(v)}
                        className="jrn-btn jrn-btn--ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                      >
                        Voir
                      </button>
                    </div>
                  );
                })}
              </div>
              <p style={{ marginTop: 'var(--jrn-2)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)' }}>
                Une nouvelle version est créée à chaque adaptation. La cliente voit uniquement la version active.
              </p>
            </div>
          )}

          <div className="jrn-actions">
            <button onClick={onExit} className="jrn-btn jrn-btn--ghost">
              ← Retour dashboard
            </button>
          </div>
        </>
      )}

      <ErrorLine msg={err} />

      {/* Modale aperçu d'une version archivée */}
      {previewVersion && (
        <PlanVersionPreviewModal version={previewVersion} onClose={() => setPreviewVersion(null)} />
      )}

      {/* Modale saisie consultation effectuée */}
      {showLogModal && (
        <LogConsultationModal
          consultationNumber={consultationsUsed + 1}
          totalIncluded={consultationsTotal}
          note={logNote}
          setNote={setLogNote}
          onCancel={() => { setShowLogModal(false); setLogNote(''); }}
          onConfirm={handleLogConsultation}
          saving={savingLog}
        />
      )}
    </section>
  );
}

function LogConsultationModal({ consultationNumber, totalIncluded, note, setNote, onCancel, onConfirm, saving }) {
  return (
    <div className="jpe-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}>
      <div className="jpe-modal">
        <header className="jpe-modal__header">
          <div>
            <p className="jrn-step-eyebrow">Consultation effectuée</p>
            <h3 className="jpe-modal__title">
              Consultation n°{consultationNumber}
              {totalIncluded > 0 && <span style={{ fontSize: 14, color: 'var(--jrn-text-muted)', fontStyle: 'normal', marginLeft: 8 }}>/ {totalIncluded}</span>}
            </h3>
          </div>
          <button onClick={onCancel} disabled={saving} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>
        <div className="jpe-modal__body">
          <p style={{ fontSize: 13, color: 'var(--jrn-text-soft)', marginTop: 0, marginBottom: 'var(--jrn-3)', lineHeight: 1.6 }}>
            Marquez cette consultation comme effectuée. Vous pouvez ajouter une note rapide (axes abordés, décisions, ressentis cliente). Cette note reste interne — non envoyée à la cliente.
          </p>

          <label className="jrn-label" htmlFor="consult-note">Note de consultation (optionnel)</label>
          <textarea
            id="consult-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            className="jrn-textarea"
            placeholder="Ex : Cliente très motivée, fatigue résolue, microbiome amélioré. Décisions : continuer protocole 2 semaines puis ajouter mélatonine si insomnie persiste."
            disabled={saving}
          />

          <div className="jrn-actions">
            <button onClick={onConfirm} disabled={saving} className="jrn-btn jrn-btn--primary">
              {saving ? 'Enregistrement…' : '✅ Marquer effectuée'}
            </button>
            <button onClick={onCancel} disabled={saving} className="jrn-btn jrn-btn--ghost">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini modale d'aperçu lecture seule d'une version du plan
function PlanVersionPreviewModal({ version, onClose }) {
  const text = version.nutritionPlan || version.nutrition_plan || '';
  const date = version.createdAt ? new Date(version.createdAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  return (
    <div className="jpe-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jpe-modal jpe-modal--xl">
        <header className="jpe-modal__header">
          <div>
            <p className="jrn-step-eyebrow">Version archivée</p>
            <h3 className="jpe-modal__title">{version.label || 'Plan'}</h3>
            <p style={{ fontSize: 11, color: 'var(--jrn-text-muted)', marginTop: 4 }}>{date}</p>
          </div>
          <button onClick={onClose} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>
        <div className="jpe-modal__body">
          <div className="jpe-preview">
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.65,
              color: 'var(--jrn-text)',
              margin: 0,
            }}>{text}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
