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
import JourneyNotesPanel from './JourneyNotesPanel';
import PremiumSwitch from './components/PremiumSwitch';
import { getNutritionConsultations } from './store';
import { trackPlanValidated, trackPlanModification } from './services/observability';
import './styles/journey.css';

export default function ClientJourneyPage({ clientId, onExit, onEditProfile, onReturnPlan, onSendPackReview, onViewHistory }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Phase T : aperçu app cliente (modal mockup téléphone)
  const [showAppPreview, setShowAppPreview] = useState(false);
  const [previewConsultation, setPreviewConsultation] = useState(null);
  // Phase AC : panel latéral messagerie SaaS ↔ cliente
  const [showMessages, setShowMessages] = useState(false);
  // Phase AE : panel latéral notes internes Anissa
  const [showNotes, setShowNotes] = useState(false);

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
  const nom = client.nom || client.form?.nom || '';
  const currentStep = journey.current_step || 'anamnesis';

  const stepStatuses = JOURNEY_STEPS.map((s) => ({ step: s, status: getStepStatus(journey, s) }));
  const completedCount = stepStatuses.filter((s) => s.status === 'validated' || s.status === 'skipped').length;
  const currentStepIndex = STEP_META[currentStep]?.index || 1;
  // BC.5G.12 : la barre suit la position courante (currentStepIndex - 1) et
  // pas les flags _validated. Comme ça quand Anissa revient en arrière via
  // la flèche ←, la barre redescend pour refléter où elle est vraiment.
  // Cas particulier : si on est à l'étape 8 et que followup_started=true,
  // le parcours est complet → 100%.
  const isParcoursComplete = currentStep === 'followup' && journey.followup_started;
  const progressPct = isParcoursComplete
    ? 100
    : Math.round(((currentStepIndex - 1) / JOURNEY_STEPS.length) * 100);

  // Phase AJ : compteur consultations utilisées vs incluses dans le pack
  const consultationsTotal = pack?.consultations || 0;
  const consultationsLog = Array.isArray(journey?.consultations_log) ? journey.consultations_log : [];
  const consultationsUsed = consultationsLog.length;

  // BC.2 (2026-05-11) : helpers cockpit cliente
  // Initiales pour avatar (FB depuis "Farid Benyahia", F si pas de nom)
  const initials = (
    (prenom?.[0] || '') + (nom?.[0] || '')
  ).toUpperCase() || '?';
  // Jour J du pack (depuis packStartedAt si dispo)
  const daysSincePack = client.packStartedAt
    ? Math.max(1, Math.floor((Date.now() - new Date(client.packStartedAt).getTime()) / 86400000) + 1)
    : null;
  // Dernière consultation effectuée (pour "dernier check-in")
  const lastConsultation = consultationsLog.length > 0 ? consultationsLog[consultationsLog.length - 1] : null;
  const daysSinceLastConsult = lastConsultation
    ? Math.floor((Date.now() - new Date(lastConsultation.date).getTime()) / 86400000)
    : null;

  // BC.3C (2026-05-11) : status contextuel parcours pour pill premium header.
  // Donne un signal émotionnel ("Onboarding actif", "Plan en édition"...)
  // au lieu de juste afficher le step courant en bas.
  const statusContext = (() => {
    switch (currentStep) {
      case 'anamnesis':       return { label: 'Onboarding actif', tone: 'accent' };
      case 'analyses':        return { label: 'Phase analyses',   tone: 'accent' };
      case 'waiting_results': return { label: 'Attente résultats', tone: 'neutral' };
      case 'results':         return { label: 'Saisie résultats',  tone: 'accent' };
      case 'plan_generation': return { label: 'Génération du plan', tone: 'gold' };
      case 'plan_editing':    return { label: 'Plan en édition',   tone: 'gold' };
      case 'delivery':        return { label: 'Livraison en cours', tone: 'gold' };
      case 'followup':        return { label: 'Suivi en cours',    tone: 'accent' };
      default:                return { label: 'Parcours',          tone: 'neutral' };
    }
  })();

  const refresh = () => loadClient();

  return (
    <div className="jrn-page">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="jrn-header">
        {/* BC.2 (2026-05-11) : header refondu en cockpit cliente.
            Avatar initiales + bloc identité (nom complet + eyebrow méta)
            + ligne stats pills (pack / consultations / jour pack / dernier check-in)
            + progression à droite + actions. */}
        <div className="jrn-header__identity">
          <div className="jrn-header__avatar" aria-hidden="true">{initials}</div>
          <div className="jrn-header__id">
            <p className="jrn-header__eyebrow">
              Parcours cliente{pack ? ` · ${pack.label}` : ''}
            </p>
            <h1 className="jrn-header__name">
              {prenom}{nom ? ` ${nom}` : ''}
            </h1>
            <div className="jrn-header__meta">
              {/* BC.3C : status contextuel premium en premier (pill avec dot pulse) */}
              <span className={`jrn-status-pill jrn-status-pill--${statusContext.tone}`}>
                <span className="jrn-status-pill__dot" aria-hidden="true" />
                {statusContext.label}
              </span>
              {consultationsTotal > 0 && (
                <span
                  className="jrn-meta-chip jrn-meta-chip--gold"
                  title={`${consultationsUsed} consultation${consultationsUsed > 1 ? 's' : ''} effectuée${consultationsUsed > 1 ? 's' : ''} sur ${consultationsTotal} incluse${consultationsTotal > 1 ? 's' : ''}`}
                >
                  <span className="jrn-meta-chip__icon">📅</span>
                  {consultationsUsed} / {consultationsTotal} consultations
                </span>
              )}
              {daysSincePack && (
                <span className="jrn-meta-chip jrn-meta-chip--neutral" title={`Pack démarré le ${new Date(client.packStartedAt).toLocaleDateString('fr-CH')}`}>
                  <span className="jrn-meta-chip__icon">📆</span>
                  Jour {daysSincePack} du pack
                </span>
              )}
              {daysSinceLastConsult !== null && (
                <span className="jrn-meta-chip jrn-meta-chip--accent" title={`Dernière consultation : ${new Date(lastConsultation.date).toLocaleDateString('fr-CH')}`}>
                  <span className="jrn-meta-chip__icon">✓</span>
                  Dernier RDV {daysSinceLastConsult === 0 ? 'aujourd\'hui' : `il y a ${daysSinceLastConsult}j`}
                </span>
              )}
            </div>
          </div>
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

        {/* BC.3C : actions header groupées en 2 zones distinctes.
            Zone 1 (actions cliente — soft accent) : Messages / Notes / Aperçu app
            Séparateur visuel
            Zone 2 (navigation — ghost) : Étape précédente / Profil / Dashboard */}
        <div className="jrn-header__actions">
          <div className="jrn-header__actions-group">
            <button
              onClick={() => setShowMessages(true)}
              className="jrn-btn jrn-btn--soft"
              title="Messages avec la cliente + ressentis reçus"
            >
              💬 Messages
            </button>
            <button
              onClick={() => setShowNotes(true)}
              className="jrn-btn jrn-btn--soft"
              title="Notes internes privées sur la cliente (jamais envoyées)"
            >
              📝 Notes
            </button>
            <button
              onClick={openAppPreview}
              className="jrn-btn jrn-btn--soft"
              title="Aperçu de ce que la cliente voit dans l'app"
            >
              📱 Aperçu app
            </button>
          </div>

          <span className="jrn-header__actions-sep" aria-hidden="true" />

          <div className="jrn-header__actions-group">
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
                ←
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
        </div>
      </header>

      {/* ─── Body : sidebar + main ──────────────────────────────── */}
      <div className="jrn-body">
        <aside className="jrn-sidebar">
          {/* ─── Étapes du parcours (timeline verticale) ─────────── */}
          <p className="jrn-sidebar__label">Parcours</p>
          <div className="jrn-steps">
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
          </div>

          {/* ─── BC.3B Cockpit clinique cliente ────────────────────
              Pack actif + suivi (consultations, jour pack, dernier RDV)
              + statut app cliente. Remplace le résumé minimal AR.3. */}
          <div className="jrn-cockpit">
            {pack && (
              <div className="jrn-cockpit__section">
                <p className="jrn-cockpit__label">Pack actif</p>
                <p className="jrn-cockpit__pack">{pack.label}</p>
              </div>
            )}

            {(consultationsTotal > 0 || daysSincePack || daysSinceLastConsult !== null) && (
              <div className="jrn-cockpit__section">
                <p className="jrn-cockpit__label">Suivi</p>
                {consultationsTotal > 0 && (
                  <div className="jrn-cockpit__stat">
                    <div className="jrn-cockpit__stat-head">
                      <span className="jrn-cockpit__stat-key">Consultations</span>
                      <span className="jrn-cockpit__stat-val">{consultationsUsed} <span className="jrn-cockpit__stat-total">/ {consultationsTotal}</span></span>
                    </div>
                    <div className="jrn-cockpit__bar">
                      <div
                        className="jrn-cockpit__bar-fill"
                        style={{ width: `${Math.min(100, Math.round((consultationsUsed / consultationsTotal) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
                {daysSincePack && (
                  <div className="jrn-cockpit__row">
                    <span className="jrn-cockpit__row-key">📆 Pack démarré</span>
                    <span className="jrn-cockpit__row-val">Jour {daysSincePack}</span>
                  </div>
                )}
                {daysSinceLastConsult !== null && (
                  <div className="jrn-cockpit__row">
                    <span className="jrn-cockpit__row-key">✓ Dernier RDV</span>
                    <span className="jrn-cockpit__row-val">
                      {daysSinceLastConsult === 0 ? 'aujourd\'hui' : `il y a ${daysSinceLastConsult}j`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="jrn-cockpit__section">
              <p className="jrn-cockpit__label">Espace cliente</p>
              <div className="jrn-cockpit__row">
                <span className="jrn-cockpit__row-key">📱 App cliente</span>
                <span className={`jrn-cockpit__pill ${client.app_enabled ? 'jrn-cockpit__pill--on' : 'jrn-cockpit__pill--off'}`}>
                  {client.app_enabled ? 'Activée' : 'Non activée'}
                </span>
              </div>
            </div>

            <div className="jrn-cockpit__section jrn-cockpit__section--next">
              <p className="jrn-cockpit__label">Prochaine action</p>
              <p className="jrn-cockpit__next">
                {STEP_META[currentStep]?.label || '—'}
              </p>
              <p className="jrn-cockpit__next-meta">Étape {currentStepIndex} / {JOURNEY_STEPS.length} · {progressPct}%</p>
            </div>
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

        {/* Phase AE : Panel notes internes Anissa (slide-in droite) */}
        {showNotes && (
          <JourneyNotesPanel
            client={client}
            onClose={() => setShowNotes(false)}
          />
        )}

        <main className="jrn-main">
          {currentStep === 'anamnesis' && <StepAnamnesis client={client} onChange={refresh} />}
          {currentStep === 'analyses' && <StepAnalyses client={client} journey={journey} onChange={refresh} />}
          {currentStep === 'waiting_results' && <StepWaitingResults client={client} onChange={refresh} />}
          {currentStep === 'results' && <StepResults client={client} onChange={refresh} />}
          {currentStep === 'plan_generation' && <StepPlanGeneration client={client} journey={journey} onChange={refresh} />}
          {currentStep === 'plan_editing' && <StepPlanEditing client={client} journey={journey} onChange={refresh} />}
          {currentStep === 'delivery' && <StepDelivery client={client} onChange={refresh} />}
          {currentStep === 'followup' && <StepFollowup client={client} journey={journey} onChange={refresh} onExit={onExit} onReturnPlan={onReturnPlan} onSendPackReview={onSendPackReview} onViewHistory={onViewHistory} />}
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

// BB.2 (2026-05-11) : Étape 1 refondue en cockpit Onboarding (4 blocs).
// Reflète le workflow réel d'Anissa :
//   1. Configurer le mode d'accompagnement (app/papier/poids/notifs)
//   2. Envoyer le pré-questionnaire
//   3. Recevoir les réponses
//   4. Valider l'onboarding (= passer aux analyses)
function StepAnamnesis({ client, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sendingQuestionnaire, setSendingQuestionnaire] = useState(null); // 'app' | 'link' | null
  const form = client.form || {};
  const journey = client.journey_state || {};

  // ─── Détection statuts ──────────────────────────────────────────
  // Réponses reçues : le form a au moins un champ clé rempli (objectifs/symptômes/pathologies/activité)
  const minimallyFilled = !!(form.objectifs || form.symptomes || form.pathologies || form.activite);
  const questionnaireSentAt = journey.questionnaire_sent_at || null;
  const questionnaireMode = journey.questionnaire_mode || null; // 'app' | 'link'
  const questionnaireReceived = minimallyFilled;

  const handleSendQuestionnaire = async (mode) => {
    setSendingQuestionnaire(mode);
    setErr(null);
    try {
      const { openClientWelcomeAppMail, openClientQuestionnaireMail } = await import('./services/sendClientQuestionnaire');
      if (mode === 'app') openClientWelcomeAppMail(client);
      else openClientQuestionnaireMail(client);
      // Track l'envoi dans journey_state
      const { updateJourneyState } = await import('./services/journeyState');
      await updateJourneyState(client.id, {
        questionnaire_sent_at: new Date().toISOString(),
        questionnaire_mode: mode,
      });
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur envoi');
    } finally {
      setSendingQuestionnaire(null);
    }
  };

  const handleValidate = async () => {
    if (!minimallyFilled && !window.confirm('Continuer sans avoir reçu les réponses du pré-questionnaire ?\n\nLa cliente n\'a pas encore rempli le pré-questionnaire ou tu n\'as pas encore fait le RDV.')) return;
    setBusy(true); setErr(null);
    try {
      await transitions.validateAnamnesis(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur transition'); }
    finally { setBusy(false); }
  };

  const hasEmail = !!(client.form?.email || client.email);

  return (
    <section>
      <StepHead
        index={1}
        title="Onboarding cliente"
        intro="Configurez l'expérience cliente, envoyez le pré-questionnaire, recueillez les réponses, puis validez pour lancer le parcours."
      />

      {/* ═══ BLOC 1 — Mode d'accompagnement ════════════════════════ */}
      <div style={{ marginBottom: 'var(--jrn-6)' }}>
        <p className="jrn-label">1 · Mode d'accompagnement</p>
        <p style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginTop: 4, marginBottom: 'var(--jrn-3)', lineHeight: 1.55 }}>
          Décide ici comment la cliente va vivre son parcours : app permanente, livraison papier, tracking poids. Ces choix peuvent être ajustés plus tard.
        </p>
        <div className="jrn-surface" style={{ padding: 'var(--jrn-6)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jrn-4)' }}>
            <OnboardingOption
              icon="📱"
              title="App cliente"
              description="Compte permanent avec timeline, notifications, suivi continu. Recommandé pour les suivis longs."
              status={client.app_enabled ? 'active' : 'inactive'}
              hint={client.app_enabled ? 'Activée — la cliente peut se connecter via /login' : 'Activable depuis le bouton Profil en haut'}
            />
            <OnboardingOption
              icon="⚖️"
              title="Suivi du poids"
              description="La cliente saisit son poids dans son ressenti quotidien. Configurable étape 7 Livraison."
              status="config-elsewhere"
              hint="Configurer dans étape 7 Livraison (toggles tracking + visible)"
            />
            <OnboardingOption
              icon="📦"
              title="Plan papier"
              description="Livret fondateur premium imprimé envoyé par poste. À confirmer étape 7 Livraison."
              status="config-elsewhere"
              hint="Configurer dans étape 7 Livraison (toggle papier)"
            />
          </div>
        </div>
      </div>

      {/* ═══ BLOC 2 — Pré-questionnaire ════════════════════════════ */}
      <div style={{ marginBottom: 'var(--jrn-6)' }}>
        <p className="jrn-label">2 · Pré-questionnaire</p>
        <p style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginTop: 4, marginBottom: 'var(--jrn-3)', lineHeight: 1.55 }}>
          Envoie le questionnaire à la cliente. Elle remplit 5 minutes avant le RDV anamnèse.
        </p>
        <div className="jrn-surface" style={{ padding: 'var(--jrn-6)' }}>
          {!hasEmail && (
            <p style={{ margin: 0, fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-warn)' }}>
              ⚠ Cliente sans email — impossible d'envoyer. Renseignez l'email via Profil.
            </p>
          )}
          {hasEmail && !questionnaireSentAt && (
            <>
              <div className="jrn-actions" style={{ marginTop: 0 }}>
                <button
                  onClick={() => handleSendQuestionnaire('app')}
                  disabled={sendingQuestionnaire !== null}
                  className="jrn-btn jrn-btn--primary"
                  title="Mail Bienvenue + lien /login de l'app cliente. Compte permanent."
                >
                  {sendingQuestionnaire === 'app' ? 'Envoi…' : '📱 Envoyer via l\'app cliente'}
                </button>
                <button
                  onClick={() => handleSendQuestionnaire('link')}
                  disabled={sendingQuestionnaire !== null}
                  className="jrn-btn jrn-btn--soft"
                  title="Mail Gmail avec lien direct /questionnaire. Pas besoin de compte."
                >
                  {sendingQuestionnaire === 'link' ? 'Envoi…' : '📩 Envoyer par lien email'}
                </button>
              </div>
              <p style={{ marginTop: 'var(--jrn-3)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)', lineHeight: 1.55 }}>
                <strong>App</strong> = compte permanent (timeline + notifs + suivi). <strong>Lien</strong> = un seul questionnaire à remplir, pas de compte.
              </p>
            </>
          )}
          {hasEmail && questionnaireSentAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jrn-3)', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'var(--jrn-accent-soft)',
                color: 'var(--jrn-accent)',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}>
                ✓ Envoyé {questionnaireMode === 'app' ? '— mode app' : '— mode lien'}
              </span>
              <span style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-muted)' }}>
                le {new Date(questionnaireSentAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => handleSendQuestionnaire(questionnaireMode || 'app')}
                disabled={sendingQuestionnaire !== null}
                className="jrn-btn jrn-btn--ghost"
                style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 12px' }}
              >
                ↻ Renvoyer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ BLOC 3 — Réponses reçues ══════════════════════════════ */}
      <div style={{ marginBottom: 'var(--jrn-6)' }}>
        <p className="jrn-label">3 · Réponses reçues</p>
        <p style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginTop: 4, marginBottom: 'var(--jrn-3)', lineHeight: 1.55 }}>
          Les réponses arrivent quand la cliente soumet le formulaire (ou pendant le RDV si tu remplis manuellement).
        </p>
        <div className="jrn-surface" style={{ padding: 'var(--jrn-6)' }}>
          {questionnaireReceived ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jrn-3)', marginBottom: 'var(--jrn-3)' }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'var(--jrn-accent-soft)',
                  color: 'var(--jrn-accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                }}>
                  🟢 Reçu
                </span>
              </div>
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
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jrn-3)' }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(184, 134, 38, 0.10)',
                color: '#8a6722',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}>
                🟡 En attente
              </span>
              <span style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-muted)' }}>
                Aucune réponse pour l'instant. La cliente n'a pas encore rempli le questionnaire.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ BLOC 4 — Validation onboarding (CTA final) ═══════════ */}
      <div style={{ marginBottom: 'var(--jrn-6)' }}>
        <p className="jrn-label">4 · Validation</p>
        <p style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginTop: 4, marginBottom: 'var(--jrn-3)', lineHeight: 1.55 }}>
          Une fois le RDV anamnèse fait et les informations clés vérifiées, validez pour passer à l'étape Analyses.
        </p>
        <div className="jrn-actions" style={{ marginTop: 0 }}>
          <button onClick={handleValidate} disabled={busy} className="jrn-btn jrn-btn--primary">
            {busy ? '…' : (questionnaireReceived ? 'Valider l\'onboarding et passer aux analyses' : 'Continuer le parcours →')}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)', marginTop: 'var(--jrn-4)' }}>
        L'édition complète de l'anamnèse se fait via le bouton <strong>Profil</strong> en haut.
      </p>
      <ErrorLine msg={err} />
    </section>
  );
}

// Bloc OnboardingOption — option avec icône, titre, description, statut
function OnboardingOption({ icon, title, description, status, hint }) {
  // status: 'active' | 'inactive' | 'config-elsewhere'
  const badgeProps = {
    active:           { label: 'Activé',         bg: 'var(--jrn-accent-soft)',     color: 'var(--jrn-accent)' },
    inactive:         { label: 'Inactif',        bg: 'rgba(40,32,20,0.06)',         color: 'var(--jrn-text-muted)' },
    'config-elsewhere':{ label: 'À configurer',  bg: 'rgba(184,134,38,0.10)',       color: '#8a6722' },
  }[status] || { label: status, bg: 'rgba(0,0,0,0.05)', color: 'var(--jrn-text-muted)' };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--jrn-4)' }}>
      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jrn-2)', marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--jrn-text)' }}>{title}</span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 999,
            background: badgeProps.bg,
            color: badgeProps.color,
            textTransform: 'uppercase',
            letterSpacing: '.04em',
            whiteSpace: 'nowrap',
          }}>
            {badgeProps.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--jrn-text-soft)', lineHeight: 1.55 }}>{description}</div>
        {hint && (
          <div style={{ fontSize: 11, color: 'var(--jrn-text-muted)', marginTop: 4, fontStyle: 'italic' }}>{hint}</div>
        )}
      </div>
    </div>
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

      {/* BC.5B : structure en blocs numérotés style étape 1 (Onboarding) */}

      {/* ─── Bloc 1 : Plan d'analyses ────────────────────────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">1</span>
          <h3 className="jrn-block__title">Plan d'analyses</h3>
        </div>
        <p className="jrn-block__intro">
          {hasPlan === false
            ? 'Lance la suggestion IA pour proposer un plan d\'analyses adapté à l\'anamnèse. Tu valideras ensuite chaque test individuellement avant prescription.'
            : hasPlan === true
            ? 'Le plan d\'analyses est en place. Vérifie les tests sélectionnés ci-dessous avant validation.'
            : 'Chargement du statut…'}
        </p>

        {hasPlan === null && (
          <div className="jrn-surface jrn-surface--quiet">
            <div className="jrn-empty">
              <div className="jrn-empty__icon">⏳</div>
              <p className="jrn-empty__title">Vérification en cours</p>
              <p className="jrn-empty__hint">Chargement du plan d'analyses de la cliente…</p>
            </div>
          </div>
        )}

        {hasPlan === false && (
          <div className="jrn-surface jrn-surface--quiet">
            <div className="jrn-empty">
              <div className="jrn-empty__icon">🧪</div>
              <p className="jrn-empty__title">Aucun plan d'analyses</p>
              <p className="jrn-empty__hint">
                L'IA va proposer des tests en croisant l'anamnèse, le pack acheté et les axes prioritaires. Tu garderas la main pour valider, écarter ou ajouter.
              </p>
              <div className="jrn-actions" style={{ marginTop: 'var(--jrn-2)' }}>
                <button onClick={() => setShowSuggest(true)} className="jrn-btn jrn-btn--primary">
                  ✨ Lancer la suggestion IA
                </button>
                <button onClick={handleSkip} disabled={savingTransition} className="jrn-btn jrn-btn--ghost">
                  Passer cette étape
                </button>
              </div>
            </div>
          </div>
        )}

        {hasPlan === true && <AnalysisPlanCard clientId={client.id} />}
      </div>

      {/* ─── Bloc 2 : Validation (si plan en place) ─────────────── */}
      {hasPlan === true && (
        <div className="jrn-block">
          <div className="jrn-block__head">
            <span className="jrn-block__num">2</span>
            <h3 className="jrn-block__title">Validation</h3>
          </div>
          <p className="jrn-block__intro">
            Une fois les tests vérifiés, valide pour passer en attente des résultats.
          </p>
          <div className="jrn-actions" style={{ marginTop: 0 }}>
            <button onClick={handleValidate} disabled={savingTransition} className="jrn-btn jrn-btn--hero">
              {savingTransition ? '…' : 'Valider et passer en attente résultats →'}
            </button>
          </div>
        </div>
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

      {/* BC.5C : narration timeline visuelle + bloc actions */}

      {/* ─── Bloc 1 : Timeline d'envoi ────────────────────────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">1</span>
          <h3 className="jrn-block__title">Statut d'envoi</h3>
        </div>
        <p className="jrn-block__intro">
          La cliente a reçu sa prescription. Voici le parcours type des analyses.
        </p>

        <div className="jrn-surface">
          <ol className="jrn-timeline">
            <li className="jrn-timeline__item jrn-timeline__item--done">
              <span className="jrn-timeline__dot">✓</span>
              <div>
                <div className="jrn-timeline__title">Prescription remise</div>
                <p className="jrn-timeline__hint">Liste des analyses transmise à la cliente.</p>
              </div>
            </li>
            <li className="jrn-timeline__item jrn-timeline__item--active">
              <span className="jrn-timeline__dot">⏳</span>
              <div>
                <div className="jrn-timeline__title">Prélèvement & laboratoire</div>
                <p className="jrn-timeline__hint">La cliente effectue les prélèvements. Le labo renvoie les résultats sous 5–10 jours.</p>
              </div>
            </li>
            <li className="jrn-timeline__item">
              <span className="jrn-timeline__dot">•</span>
              <div>
                <div className="jrn-timeline__title">Réception résultats</div>
                <p className="jrn-timeline__hint">Une fois les résultats reçus, tu pourras les saisir et débloquer le plan nutritionnel.</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      {/* ─── Bloc 2 : Plan d'analyses rappel ──────────────────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">2</span>
          <h3 className="jrn-block__title">Plan d'analyses prescrit</h3>
        </div>
        <p className="jrn-block__intro">
          Récapitulatif des tests demandés. Sert de référence pour la saisie à l'étape suivante.
        </p>
        <AnalysisPlanCard clientId={client.id} />
      </div>

      {/* ─── Bloc 3 : Action — Marquer reçus ──────────────────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">3</span>
          <h3 className="jrn-block__title">Réception</h3>
        </div>
        <p className="jrn-block__intro">
          Dès que la cliente t'a transmis ses résultats (PDF, papier, ou par mail), marque comme reçu pour ouvrir l'étape de saisie.
        </p>
        <div className="jrn-actions" style={{ marginTop: 0 }}>
          <button onClick={handleReceived} disabled={busy} className="jrn-btn jrn-btn--hero">
            {busy ? '…' : '✓ Marquer les résultats comme reçus'}
          </button>
        </div>
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
      // Merge : on garde les valeurs deja saisies, on ajoute les tests du plan absents.
      // BC.5D.2 : auto-détecte la catégorie depuis le nom si pas encore définie.
      setResultsByTest((prev) => {
        const map = new Map(prev.map((r) => [r.test_code || r.test_name, r]));
        const merged = tests.map((t) => {
          const key = t.code || t.name;
          const existing = map.get(key);
          if (existing) {
            // Existant : auto-fill category seulement si null (respecte choix manuel)
            return {
              ...existing,
              category: existing.category || autoDetectCategory(existing.test_name || t.name),
            };
          }
          return {
            test_code: t.code,
            test_name: t.name || t.code,
            value: '',
            synthesis: '',
            category: autoDetectCategory(t.name || t.code),
            status: null,
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
    setExternalAnalyses((prev) => [...prev, { name: '', value: '', synthesis: '', category: null, status: null }]);
  };
  const updateExternal = (idx, field, value) => {
    setExternalAnalyses((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, [field]: value };
      // BC.5D.2 : si on tape le nom et que la catégorie n'est pas encore définie, on auto-détecte.
      if (field === 'name' && !r.category) {
        const detected = autoDetectCategory(value);
        if (detected) next.category = detected;
      }
      return next;
    }));
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

  // BC.5D : compteur statuts pour donner sensation "intelligence visible"
  const allResults = [...resultsByTest, ...externalAnalyses];
  const statusCounts = allResults.reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  // BC.5D.1 : vue clinique synthétique auto-computed depuis les analyses saisies
  // Sobre par défaut : juste compteurs status + catégories les plus présentes.
  // Apparaît uniquement si au moins 1 analyse a un status (sinon useless).
  const hasStatusedResults = Object.keys(statusCounts).length > 0;
  const categoryCounts = allResults.reduce((acc, r) => {
    if (r.category) acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  // BC.5D.2 : top catégories enrichies (value/label/icon/count) pour
  // afficher comme pills colorées au lieu de simple text.
  const topCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => {
      const meta = CATEGORIES.find((c) => c.value === key);
      return { value: key, label: meta?.label || key, icon: meta?.icon, count };
    });
  // Tonalité globale : prioritaire > surveiller > optimal
  const overallTone = statusCounts.prioritaire > 0
    ? 'prioritaire'
    : statusCounts.surveiller > 0
    ? 'surveiller'
    : statusCounts.optimal > 0
    ? 'optimal'
    : null;
  const overallLabel = overallTone === 'prioritaire'
    ? 'Profil avec marqueurs prioritaires'
    : overallTone === 'surveiller'
    ? 'Profil à surveiller'
    : 'Profil stable';

  return (
    <section>
      <StepHead
        index={4}
        title="Saisie des résultats"
        intro="Saisis les résultats de chaque analyse et ajoute celles que la cliente possédait déjà. Catégorise et priorise pour préparer une synthèse clinique structurée."
      />

      {/* BC.5D : refonte étape 4 en cockpit d'analyse clinique premium */}

      {/* ─── Vue clinique synthétique (BC.5D.1, conditionnel) ────
          Sobre : apparaît dès qu'au moins 1 analyse a un status défini.
          Donne la sensation 'quelque chose d'intelligent émerge'. */}
      {hasStatusedResults && (
        <div className={`jrn-clinical-overview jrn-clinical-overview--${overallTone}`}>
          <div className="jrn-clinical-overview__head">
            <p className="jrn-clinical-overview__eyebrow">Lecture clinique</p>
            <h3 className="jrn-clinical-overview__title">{overallLabel}</h3>
          </div>
          <div className="jrn-clinical-overview__stats">
            {statusCounts.prioritaire > 0 && (
              <div className="jrn-clinical-stat jrn-clinical-stat--prioritaire">
                <span className="jrn-clinical-stat__num">{statusCounts.prioritaire}</span>
                <span className="jrn-clinical-stat__label">🔴 Prioritaire{statusCounts.prioritaire > 1 ? 's' : ''}</span>
              </div>
            )}
            {statusCounts.surveiller > 0 && (
              <div className="jrn-clinical-stat jrn-clinical-stat--surveiller">
                <span className="jrn-clinical-stat__num">{statusCounts.surveiller}</span>
                <span className="jrn-clinical-stat__label">🟡 À surveiller</span>
              </div>
            )}
            {statusCounts.optimal > 0 && (
              <div className="jrn-clinical-stat jrn-clinical-stat--optimal">
                <span className="jrn-clinical-stat__num">{statusCounts.optimal}</span>
                <span className="jrn-clinical-stat__label">🟢 Optimal{statusCounts.optimal > 1 ? 'es' : ''}</span>
              </div>
            )}
          </div>
          {topCategories.length > 0 && (
            <div className="jrn-clinical-overview__axes">
              <span className="jrn-clinical-overview__axes-label">Axes signalés</span>
              {topCategories.map((cat) => (
                <span key={cat.value} className={`jrn-cat-pill jrn-cat-pill--${cat.value}`}>
                  <span className="jrn-cat-pill__icon">{cat.icon}</span>
                  {cat.label}
                  <span className="jrn-cat-pill__count">·&nbsp;{cat.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Bloc 1 : Analyses prescrites ──────────────────────── */}
      {planTests && planTests.length > 0 && (
        <div className="jrn-block">
          <div className="jrn-block__head">
            <span className="jrn-block__num">1</span>
            <h3 className="jrn-block__title">Analyses prescrites ({planTests.length})</h3>
            {Object.keys(statusCounts).length > 0 && (
              <div className="jrn-block__head-meta">
                {statusCounts.optimal > 0 && <span className="jrn-result-pill jrn-result-pill--optimal">{statusCounts.optimal} optimal{statusCounts.optimal > 1 ? 'es' : ''}</span>}
                {statusCounts.surveiller > 0 && <span className="jrn-result-pill jrn-result-pill--surveiller">{statusCounts.surveiller} à surveiller</span>}
                {statusCounts.prioritaire > 0 && <span className="jrn-result-pill jrn-result-pill--prioritaire">{statusCounts.prioritaire} prioritaire{statusCounts.prioritaire > 1 ? 's' : ''}</span>}
              </div>
            )}
          </div>
          <p className="jrn-block__intro">
            Pour chaque analyse : saisis les valeurs brutes, catégorise (hormonal, microbiote, etc), puis note ta lecture clinique. Le statut prioritaire/à surveiller/optimal aide à orienter le plan.
          </p>
          <div className="jrn-result-cards">
            {resultsByTest.map((r, i) => (
              <ResultCard
                key={r.test_code || i}
                title={r.test_name}
                badge="Plan d'analyses"
                badgeColor="accent"
                value={r.value}
                synthesis={r.synthesis}
                category={r.category}
                status={r.status}
                onValueChange={(v) => updateTestField(i, 'value', v)}
                onSynthesisChange={(v) => updateTestField(i, 'synthesis', v)}
                onCategoryChange={(v) => updateTestField(i, 'category', v)}
                onStatusChange={(v) => updateTestField(i, 'status', v)}
              />
            ))}
          </div>
        </div>
      )}

      {planTests && planTests.length === 0 && (
        <div className="jrn-block">
          <div className="jrn-surface jrn-surface--quiet">
            <div className="jrn-empty">
              <div className="jrn-empty__icon">🧪</div>
              <p className="jrn-empty__title">Aucune analyse prescrite</p>
              <p className="jrn-empty__hint">
                Cette cliente n'a pas de plan d'analyses validé. Tu peux tout de même saisir des analyses externes ci-dessous.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bloc 2 : Analyses externes ─────────────────────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">{planTests && planTests.length > 0 ? '2' : '1'}</span>
          <h3 className="jrn-block__title">Analyses externes ({externalAnalyses.length})</h3>
          <button onClick={addExternal} className="jrn-btn jrn-btn--soft" style={{ marginLeft: 'auto' }}>
            + Ajouter une analyse
          </button>
        </div>
        <p className="jrn-block__intro">
          Analyses que la cliente possédait avant le suivi (autres laboratoires, anciens bilans, dosages spécifiques).
        </p>
        {externalAnalyses.length === 0 && (
          <div className="jrn-surface jrn-surface--quiet">
            <div className="jrn-empty">
              <div className="jrn-empty__icon">📋</div>
              <p className="jrn-empty__title">Aucune analyse externe</p>
              <p className="jrn-empty__hint">
                Si la cliente t'a transmis des résultats antérieurs au suivi, ajoute-les ici pour enrichir le contexte clinique.
              </p>
            </div>
          </div>
        )}
        {externalAnalyses.length > 0 && (
          <div className="jrn-result-cards">
            {externalAnalyses.map((r, i) => (
              <ResultCard
                key={i}
                editable
                title={r.name}
                badge="Externe"
                badgeColor="muted"
                value={r.value}
                synthesis={r.synthesis}
                category={r.category}
                status={r.status}
                onTitleChange={(v) => updateExternal(i, 'name', v)}
                onValueChange={(v) => updateExternal(i, 'value', v)}
                onSynthesisChange={(v) => updateExternal(i, 'synthesis', v)}
                onCategoryChange={(v) => updateExternal(i, 'category', v)}
                onStatusChange={(v) => updateExternal(i, 'status', v)}
                onDelete={() => removeExternal(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Bloc 3 : Synthèse clinique globale (carte premium) ─ */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">{planTests && planTests.length > 0 ? '3' : '2'}</span>
          <h3 className="jrn-block__title">Synthèse clinique globale</h3>
        </div>
        <p className="jrn-block__intro">
          Vue d'ensemble éditoriale : priorités identifiées, axes nutritionnels, signaux croisés. Sera injectée dans le prompt IA de génération du plan.
        </p>
        <div className="jrn-synthesis">
          <textarea
            value={globalSynthesis}
            onChange={(e) => setGlobalSynthesis(e.target.value)}
            rows={9}
            placeholder="Ex: Carence en B12 confirmée, microbiome déséquilibré (faible diversité), inflammation latente. Prioriser anti-inflammatoire + soutien microbiote, supplémentation B12 méthylée…"
            className="jrn-synthesis__textarea"
          />
          <div className="jrn-synthesis__hints">
            <span className="jrn-synthesis__hint-pill">Priorités identifiées</span>
            <span className="jrn-synthesis__hint-pill">Axes nutritionnels</span>
            <span className="jrn-synthesis__hint-pill">Points inflammatoires</span>
            <span className="jrn-synthesis__hint-pill">Signaux croisés</span>
          </div>
        </div>
      </div>

      {/* ─── Bloc 4 : Validation ──────────────────────────────── */}
      <div className="jrn-block">
        <div className="jrn-actions" style={{ marginTop: 0 }}>
          <button onClick={handleValidate} disabled={busy} className="jrn-btn jrn-btn--hero">
            {busy ? '…' : '✓ Valider et débloquer le plan nutritionnel →'}
          </button>
        </div>
      </div>
      <ErrorLine msg={err} />
    </section>
  );
}

// BC.5D : Carte d'analyse refondue en cockpit d'interprétation clinique.
// Header : titre + badge type + catégorie auto-détectée (cliquable) +
// statut clinique (🟢/🟡/🔴)
// 2 sections séparées : Valeurs labo (monospace fond teinté) / Lecture clinique
const CATEGORIES = [
  { value: 'hormonal',    label: 'Hormonal',     icon: '⚭' },
  { value: 'microbiote',  label: 'Microbiote',   icon: '⚗' },
  { value: 'inflammation',label: 'Inflammation', icon: '✦' },
  { value: 'carence',     label: 'Carence',      icon: '◆' },
  { value: 'metabolique', label: 'Métabolique',  icon: '◈' },
  { value: 'autre',       label: 'Autre',        icon: '○' },
];
const STATUSES = [
  { value: 'optimal',     label: 'Optimal',      icon: '🟢' },
  { value: 'surveiller',  label: 'À surveiller', icon: '🟡' },
  { value: 'prioritaire', label: 'Prioritaire',  icon: '🔴' },
];

// BC.5D.2 : auto-détection catégorie depuis le nom de l'analyse.
// Mapping mots-clés → catégorie. Anissa peut toujours surcharger via le badge.
// Couvre les analyses les plus fréquentes (cortisol, vit D, microbiote, CRP, etc).
const CATEGORY_KEYWORDS = {
  hormonal: [
    'cortisol', 'tsh', 't3', 't4', 'tpo', 'thyro', 'oestrog', 'estrog', 'testo',
    'progester', 'dhea', 'acth', 'lh ', 'fsh', 'prolac', 'insuline', 'igf',
    'hormone', 'mélatonine', 'melatoni',
  ],
  microbiote: [
    'microbiot', 'microbiom', 'mikrobiom', 'candida', 'dysbi', 'iga sécr',
    'iga secre', 'zonuline', 'akkermansia', 'firmicutes', 'bacteroidetes',
    'calprotect', 'lactoferrin', 'flore', 'parasit', 'helmint', 'levure',
  ],
  inflammation: [
    'crp', 'vs ', 'fibrinog', 'ferritine', 'il-6', 'il6', 'tnf', 'inflam',
    'anti-tpo', 'ana ', 'rhumat', 'omega-6/3', 'omega 6/3',
    'homocyst', 'apo b', 'lp(a)',
  ],
  carence: [
    'b12', 'vit b', 'vitamine b', 'vit d', 'vitamine d', 'd3', '25-oh',
    'folate', 'fer ', 'transferrin', 'magnés', 'magnes', 'zinc',
    'calcium', 'cuivre', 'sélén', 'selen', 'iode', 'omega 3', 'oméga 3',
    'vit a', 'vitamine a', 'vit c', 'vitamine c', 'vit e', 'vitamine e',
    'vit k', 'vitamine k', 'q10', 'choline',
  ],
  metabolique: [
    'glycém', 'glycem', 'hba1c', 'cholest', 'ldl', 'hdl', 'triglyc',
    'urée', 'uree', 'créatin', 'creatin', 'tgo', 'tgp', 'alat', 'asat',
    'gamma gt', 'ggt', 'bilirub', 'glucose', 'foie', 'rénal', 'renal',
  ],
};

function autoDetectCategory(name) {
  if (!name || typeof name !== 'string') return null;
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return null;
}

function ResultCard({
  title, badge, badgeColor,
  value, synthesis,
  category, status,
  onValueChange, onSynthesisChange,
  onCategoryChange, onStatusChange,
  editable, onTitleChange, onDelete,
}) {
  // BC.5D.2 : badge catégorie cliquable (toggle dropdown sur clic)
  const [editingCategory, setEditingCategory] = useState(false);
  const statusClass = status ? `jrn-result-card--${status}` : '';
  const categoryMeta = category ? CATEGORIES.find((c) => c.value === category) : null;

  return (
    <div className={`jrn-result-card ${statusClass}`}>
      {/* Header : titre + badges source/category + status select */}
      <header className="jrn-result-card__head">
        <div className="jrn-result-card__head-left">
          {editable ? (
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="jrn-result-card__title-input"
              placeholder="Nom de l'analyse"
            />
          ) : (
            <h4 className="jrn-result-card__title">{title}</h4>
          )}
          <div className="jrn-result-card__head-badges">
            <span className={`jrn-result-card__source jrn-result-card__source--${badgeColor || 'neutral'}`}>{badge}</span>
            {/* BC.5D.2 : badge catégorie cliquable.
                Si pas en édition : badge coloré (ou placeholder cliquable si null).
                Si en édition : select dropdown. */}
            {editingCategory ? (
              <select
                value={category || ''}
                onChange={(e) => { onCategoryChange?.(e.target.value || null); setEditingCategory(false); }}
                onBlur={() => setEditingCategory(false)}
                className="jrn-result-card__select"
                autoFocus
              >
                <option value="">Aucune catégorie</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            ) : categoryMeta ? (
              <button
                type="button"
                onClick={() => setEditingCategory(true)}
                className={`jrn-cat-pill jrn-cat-pill--${category}`}
                title="Modifier la catégorie"
              >
                <span className="jrn-cat-pill__icon">{categoryMeta.icon}</span>
                {categoryMeta.label}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditingCategory(true)}
                className="jrn-cat-pill jrn-cat-pill--empty"
                title="Choisir une catégorie"
              >
                + Catégorie
              </button>
            )}
          </div>
        </div>
        <div className="jrn-result-card__head-right">
          {status && (
            <span className={`jrn-result-pill jrn-result-pill--${status}`}>
              {STATUSES.find((s) => s.value === status)?.icon} {STATUSES.find((s) => s.value === status)?.label}
            </span>
          )}
          <select
            value={status || ''}
            onChange={(e) => onStatusChange?.(e.target.value || null)}
            className="jrn-result-card__select jrn-result-card__select--status"
            title="Statut clinique"
          >
            <option value="">Statut…</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
            ))}
          </select>
          {onDelete && (
            <button onClick={onDelete} className="jrn-result-card__delete" title="Supprimer">🗑</button>
          )}
        </div>
      </header>

      {/* Section 1 : Valeurs laboratoire (compact, monospace, fond teinté) */}
      <div className="jrn-result-card__values">
        <label className="jrn-result-card__section-label">Valeurs laboratoire</label>
        <textarea
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          rows={2}
          className="jrn-result-card__values-textarea"
          placeholder="Ex&nbsp;: B12 = 1200 pg/mL (norme 200-900) · Vit D = 18 ng/mL · Ferritine = 22 ng/mL…"
        />
      </div>

      {/* Section 2 : Lecture clinique Anissa (éditorial, plus lisible) */}
      <div className="jrn-result-card__interpretation">
        <label className="jrn-result-card__section-label jrn-result-card__section-label--accent">Lecture clinique</label>
        <textarea
          value={synthesis || ''}
          onChange={(e) => onSynthesisChange(e.target.value)}
          rows={3}
          className="jrn-result-card__interpretation-textarea"
          placeholder="Profil compatible avec… Pistes nutritionnelles envisagées : magnésium, gestion glycémique, soutien circadien."
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 5 — GÉNÉRATION DU PLAN
// ═══════════════════════════════════════════════════════════════════

function StepPlanGeneration({ client, journey, onChange }) {
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

  // BC.5E (2026-05-11) : refonte étape 5 en cockpit de préparation premium.
  // Au lieu d'un sas vide, on met en scène l'intelligence clinique qui va
  // nourrir la composition du plan : contexte détecté + données dispo +
  // preview de l'output IA.

  const skipped = journey?.analyses_skipped;
  const resultsData = journey?.results_data || { from_plan: [], external: [] };
  const allResults = [
    ...(resultsData.from_plan || []),
    ...(resultsData.external || []),
  ];
  const globalSynthesis = journey?.results_data?.global_synthesis || journey?.results_synthesis || '';

  // Statuts et catégories détectés depuis les analyses saisies
  const statusCounts = allResults.reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const categoryCounts = allResults.reduce((acc, r) => {
    if (r.category) acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  const topCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => {
      const meta = CATEGORIES.find((c) => c.value === key);
      return { value: key, label: meta?.label || key, icon: meta?.icon, count };
    });
  const hasContext = !skipped && (allResults.length > 0 || globalSynthesis);

  // Données dispo pour la composition (sources d'input du plan)
  const form = client.form || {};
  const pack = PACK_DEFINITIONS[client.packType] || null;
  const dataInputs = [
    { key: 'anamnesis', label: 'Anamnèse', detail: 'Objectifs, symptômes, pathologies, mode de vie', available: !!(form.objectifs || form.symptomes || form.activite) },
    { key: 'analyses', label: 'Analyses biologiques', detail: skipped ? 'Étape passée — pack sans analyses' : `${allResults.length} test${allResults.length > 1 ? 's' : ''} saisi${allResults.length > 1 ? 's' : ''}`, available: skipped || allResults.length > 0 },
    { key: 'synthesis', label: 'Synthèse clinique', detail: globalSynthesis ? `${globalSynthesis.length} caractères` : 'Pas encore rédigée', available: !!globalSynthesis },
    { key: 'pack', label: 'Pack acheté', detail: pack?.label || 'Sans pack défini', available: !!pack },
  ];

  return (
    <section>
      <StepHead
        index={5}
        title="Composition du plan"
        intro="Tu disposes maintenant de tout le contexte clinique. L'étape suivante ouvre l'atelier où l'IA générera un brouillon que tu pourras peaufiner."
      />

      {/* ─── Bloc 1 : Synthèse clinique détectée (conditionnel) ──── */}
      {hasContext && (
        <div className="jrn-block">
          <div className="jrn-block__head">
            <span className="jrn-block__num">1</span>
            <h3 className="jrn-block__title">Synthèse clinique</h3>
          </div>
          <p className="jrn-block__intro">
            Voici ce que l'analyse a fait émerger. Ces signaux orienteront la composition du protocole.
          </p>

          <div className="jrn-surface">
            {Object.keys(statusCounts).length > 0 && (
              <div className="jrn-prep__stats">
                {statusCounts.prioritaire > 0 && (
                  <div className="jrn-clinical-stat jrn-clinical-stat--prioritaire">
                    <span className="jrn-clinical-stat__num">{statusCounts.prioritaire}</span>
                    <span className="jrn-clinical-stat__label">🔴 Prioritaire{statusCounts.prioritaire > 1 ? 's' : ''}</span>
                  </div>
                )}
                {statusCounts.surveiller > 0 && (
                  <div className="jrn-clinical-stat jrn-clinical-stat--surveiller">
                    <span className="jrn-clinical-stat__num">{statusCounts.surveiller}</span>
                    <span className="jrn-clinical-stat__label">🟡 À surveiller</span>
                  </div>
                )}
                {statusCounts.optimal > 0 && (
                  <div className="jrn-clinical-stat jrn-clinical-stat--optimal">
                    <span className="jrn-clinical-stat__num">{statusCounts.optimal}</span>
                    <span className="jrn-clinical-stat__label">🟢 Optimal{statusCounts.optimal > 1 ? 'es' : ''}</span>
                  </div>
                )}
              </div>
            )}

            {topCategories.length > 0 && (
              <div className="jrn-prep__axes">
                <span className="jrn-prep__axes-label">Axes prioritaires identifiés</span>
                <div className="jrn-prep__axes-list">
                  {topCategories.map((cat) => (
                    <span key={cat.value} className={`jrn-cat-pill jrn-cat-pill--${cat.value}`}>
                      <span className="jrn-cat-pill__icon">{cat.icon}</span>
                      {cat.label}
                      <span className="jrn-cat-pill__count">·&nbsp;{cat.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {globalSynthesis && (
              <div className="jrn-prep__synthesis">
                <span className="jrn-label">Lecture clinique Anissa</span>
                <p className="jrn-prep__synthesis-text">{globalSynthesis}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Bloc 2 : Données disponibles pour la composition ────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">{hasContext ? '2' : '1'}</span>
          <h3 className="jrn-block__title">Données disponibles</h3>
        </div>
        <p className="jrn-block__intro">
          Voici les sources de contexte que l'IA mobilisera pour la composition.
        </p>
        <div className="jrn-input-list">
          {dataInputs.map((it) => (
            <div key={it.key} className={`jrn-input-item ${it.available ? 'jrn-input-item--ok' : 'jrn-input-item--missing'}`}>
              <span className="jrn-input-item__check">{it.available ? '✓' : '○'}</span>
              <div className="jrn-input-item__body">
                <span className="jrn-input-item__label">{it.label}</span>
                <span className="jrn-input-item__detail">{it.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Bloc 3 : Ce que l'IA va composer (preview narrative) ─ */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">{hasContext ? '3' : '2'}</span>
          <h3 className="jrn-block__title">Ce que l'IA va composer</h3>
        </div>
        <p className="jrn-block__intro">
          Le brouillon généré dans l'atelier suivant couvrira ces axes. Tu garderas la main pour ajuster, ré-écrire ou enrichir chaque section.
        </p>
        <ul className="jrn-output-list">
          <li className="jrn-output-item"><span className="jrn-output-item__dot">✦</span><strong>Structure alimentaire</strong> · répartition journée, équivalences, exemples</li>
          <li className="jrn-output-item"><span className="jrn-output-item__dot">✦</span><strong>Axes prioritaires personnalisés</strong> · adaptés aux signaux cliniques identifiés</li>
          <li className="jrn-output-item"><span className="jrn-output-item__dot">✦</span><strong>Recommandations ciblées</strong> · par catégorie (hormonal, microbiote, carences…)</li>
          <li className="jrn-output-item"><span className="jrn-output-item__dot">✦</span><strong>Supplémentation potentielle</strong> · suggestions à valider</li>
          <li className="jrn-output-item"><span className="jrn-output-item__dot">✦</span><strong>Conseils lifestyle</strong> · sommeil, stress, mouvement, ancrages quotidiens</li>
        </ul>
      </div>

      {/* ─── Bloc 4 : CTA — Ouvrir l'atelier ──────────────────── */}
      <div className="jrn-block">
        <div className="jrn-actions" style={{ marginTop: 0 }}>
          <button onClick={handleMarkGenerated} disabled={busy} className="jrn-btn jrn-btn--hero">
            {busy ? '…' : '✨ Ouvrir l\'atelier de composition →'}
          </button>
        </div>
        <p className="jrn-block__intro" style={{ marginTop: 'var(--jrn-3)', marginBottom: 0, fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-muted)' }}>
          L'éditeur intégré te permettra de générer un brouillon IA, le ré-écrire librement et le sauvegarder en plusieurs versions.
        </p>
      </div>

      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 6 — ÉDITION DU PLAN (composer embed)
// ═══════════════════════════════════════════════════════════════════

function StepPlanEditing({ client, journey, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [versions, setVersions] = useState([]);
  const versionsCount = versions.length;

  // BC.5G.1 : Directive IA visible en permanence dans la sidebar.
  // State + autosave debounced + suggestion auto-fill basée contexte cliente.
  const [aiDirectives, setAiDirectives] = useState('');
  const [aiDirectivesLoaded, setAiDirectivesLoaded] = useState(false);
  const [savingDirectives, setSavingDirectives] = useState('idle'); // 'idle' | 'saving' | 'saved'

  // BC.5G : fetch la liste complète des versions (pas juste count) pour
  // afficher l'historique dans la sidebar contextuelle.
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { getNutritionConsultations } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        if (!cancelled) setVersions(list);
        // Charge la directive IA depuis la dernière consultation
        const last = list[0];
        if (!cancelled && !aiDirectivesLoaded) {
          setAiDirectives(last?.aiDirectives || '');
          setAiDirectivesLoaded(true);
        }
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, journey]);

  // Autosave debounced 1.5s — persiste la directive sur la dernière consultation
  useEffect(() => {
    if (!aiDirectivesLoaded || !client?.id) return;
    const handle = setTimeout(async () => {
      try {
        setSavingDirectives('saving');
        const { getNutritionConsultations, saveNutritionConsultation } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        const last = list[0];
        if (last) {
          await saveNutritionConsultation({ ...last, aiDirectives });
          setSavingDirectives('saved');
          setTimeout(() => setSavingDirectives('idle'), 1500);
        } else {
          // Pas encore de consultation : on garde la directive en mémoire,
          // elle sera injectée à la première génération.
          setSavingDirectives('idle');
        }
      } catch {
        setSavingDirectives('idle');
      }
    }, 1500);
    return () => clearTimeout(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDirectives]);

  const handlePlanSaved = async () => {
    // Refresh des versions après une sauvegarde dans l'éditeur
    try {
      const { getNutritionConsultations } = await import('./store');
      const list = getNutritionConsultations(client.id) || [];
      setVersions(list);
    } catch { /* silencieux */ }
  };

  const handleValidate = async () => {
    if (!window.confirm('Valider le plan ?\n\nLe plan passe en étape Livraison.')) return;
    setBusy(true); setErr(null);
    try {
      await transitions.validatePlan(client.id);
      // V97.3 Phase C1 : tracking plan_validated (best-effort, post-update)
      const latest = versions[0];
      const oldest = versions[versions.length - 1];
      // ai_to_practitioner_delta_ratio : écart entre V1 (initiale IA) et la version validée.
      // Approximation par longueur — 0 = pure IA non modifiée, ratio croissant = + de réécriture.
      let aiToPractitionerDeltaRatio = null;
      if (latest?.nutritionPlan && oldest?.nutritionPlan && oldest !== latest) {
        const oldLen = oldest.nutritionPlan.length;
        const newLen = latest.nutritionPlan.length;
        if (oldLen > 0) {
          aiToPractitionerDeltaRatio = Number(Math.abs((newLen - oldLen) / oldLen).toFixed(3));
        }
      }
      trackPlanValidated({
        clientId: client.id,
        consultationId: latest?.id,
        versionId: `V${versions.length}`,
        totalLength: latest?.nutritionPlan?.length,
        aiToPractitionerDeltaRatio,
        versionsCount: versions.length,
      });
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur transition'); setBusy(false); }
  };

  // BC.5F : contexte clinique mobilisé pour la composition (reuse de step 5)
  const resultsData = journey?.results_data || { from_plan: [], external: [] };
  const allResults = [
    ...(resultsData.from_plan || []),
    ...(resultsData.external || []),
  ];
  const statusCounts = allResults.reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const categoryCounts = allResults.reduce((acc, r) => {
    if (r.category) acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  const topCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => {
      const meta = CATEGORIES.find((c) => c.value === key);
      return { value: key, label: meta?.label || key, icon: meta?.icon, count };
    });
  const hasClinicalContext = allResults.length > 0 || topCategories.length > 0;

  // BC.5G.1 : suggestion de directive IA basée sur le contexte cliente.
  // Construit un texte structuré à partir de l'anamnèse + statuts + catégories.
  const buildSuggestedDirective = () => {
    const form = client?.form || {};
    const pack = PACK_DEFINITIONS[client?.packType];
    const lines = [];

    // Pack + intro contextuelle
    if (pack?.label) lines.push(`Pack : ${pack.label}.`);

    // Objectifs
    if (form.objectifs) lines.push(`Objectifs : ${form.objectifs.split('\n')[0].slice(0, 140)}.`);

    // Pathologies / contraintes
    if (form.pathologies) lines.push(`Contraintes médicales : ${form.pathologies.split('\n')[0].slice(0, 120)}.`);

    // Allergies / aversions
    if (form.allergies) lines.push(`Allergies : ${form.allergies.slice(0, 100)}.`);

    // Top catégories (axes prioritaires)
    if (topCategories.length > 0) {
      const cats = topCategories.slice(0, 4).map((c) => c.label).join(', ').toLowerCase();
      lines.push(`Axes prioritaires détectés : ${cats}.`);
    }

    // Marqueurs prioritaires
    if (statusCounts.prioritaire > 0) {
      lines.push(`${statusCounts.prioritaire} marqueur${statusCounts.prioritaire > 1 ? 's' : ''} prioritaire${statusCounts.prioritaire > 1 ? 's' : ''} à adresser en premier.`);
    }

    // Ton et approche par défaut
    lines.push('');
    lines.push('Approche : progressive, pédagogique, sans frustration.');
    lines.push('Style : clinique premium, ton chaleureux mais rigoureux.');
    lines.push('Inclure : structure journée, équivalences, conseils lifestyle, supplémentation suggérée à valider.');

    return lines.join('\n');
  };

  const handleSuggestDirective = () => {
    const suggested = buildSuggestedDirective();
    if (aiDirectives && !window.confirm('Remplacer la directive actuelle par une suggestion construite depuis le contexte cliente ?')) return;
    setAiDirectives(suggested);
  };

  return (
    <section>
      <StepHead
        index={6}
        title="Atelier de composition"
        intro="Génère un brouillon IA, ré-écris librement, sauvegarde plusieurs versions. Une fois le protocole finalisé, valide pour passer à la livraison."
      />

      {/* BC.5G : layout 2 colonnes — atelier à gauche, cockpit contextuel à droite */}
      <div className="jrn-atelier-grid">
        {/* ─── COLONNE GAUCHE : Atelier + Validation ───────────── */}
        <div className="jrn-atelier-grid__main">

          {/* Atelier d'édition (JourneyPlanEditor — empty state intégré) */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">1</span>
              <h3 className="jrn-block__title">Atelier d'édition</h3>
              {versionsCount > 0 && (
                <div className="jrn-block__head-meta">
                  <span className="jrn-result-pill jrn-result-pill--optimal">{versionsCount} version{versionsCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            <p className="jrn-block__intro">
              Génère un brouillon IA, ré-écris à la main, audite la cohérence clinique. Chaque sauvegarde crée une version.
            </p>
            <JourneyPlanEditor client={client} onPlanSaved={handlePlanSaved} />
          </div>

          {/* Validation conditionnelle */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">2</span>
              <h3 className="jrn-block__title">Validation</h3>
            </div>
            <p className="jrn-block__intro">
              {versionsCount === 0
                ? 'Sauvegarde au moins une version du plan dans l\'atelier avant de valider.'
                : 'Le plan est prêt. Valide pour passer à la livraison (étape 7).'}
            </p>
            <div className="jrn-actions" style={{ marginTop: 0 }}>
              <button
                onClick={handleValidate}
                disabled={busy || versionsCount === 0}
                className={`jrn-btn jrn-btn--hero ${versionsCount === 0 ? 'jrn-btn--hero-locked' : ''}`}
                title={versionsCount === 0 ? 'Sauvegarde une version dans l\'atelier avant de valider' : 'Valider le plan et passer à la livraison'}
              >
                {busy ? '…' : versionsCount === 0
                  ? '🔒 Générez un brouillon pour valider'
                  : '✓ Valider le plan et passer à la livraison →'}
              </button>
            </div>
          </div>

          <ErrorLine msg={err} />
        </div>

        {/* ─── COLONNE DROITE : Cockpit contextuel sticky ───── */}
        <aside className="jrn-atelier-grid__side">
          {/* BC.5G.1 : Directive IA — cerveau du protocole, toujours visible */}
          <div className="jrn-side-card jrn-side-card--directive">
            <div className="jrn-side-card__head">
              <p className="jrn-side-card__label">
                ✦ Directive IA
              </p>
              <span className={`jrn-side-card__save-status jrn-side-card__save-status--${savingDirectives}`}>
                {savingDirectives === 'saving' && '⏳ Enregistrement…'}
                {savingDirectives === 'saved' && '✓ Enregistré'}
              </span>
            </div>
            <p className="jrn-side-card__sub-hint">
              Le cerveau du protocole : ton, philosophie, contraintes, exclusions. Sera injecté dans toutes les générations IA.
            </p>
            <textarea
              value={aiDirectives}
              onChange={(e) => setAiDirectives(e.target.value)}
              placeholder="Ex : approche douce, sans gluten, focus microbiote + fatigue, éviter restriction agressive, style pédagogique…"
              rows={9}
              className="jrn-side-directive__textarea"
            />
            <button
              type="button"
              onClick={handleSuggestDirective}
              className="jrn-side-directive__suggest"
              title="Construire une suggestion depuis l'anamnèse, le pack et les analyses"
            >
              ✨ Suggérer depuis le contexte cliente
            </button>
          </div>

          {/* Contexte clinique */}
          {hasClinicalContext && (
            <div className="jrn-side-card">
              <p className="jrn-side-card__label">Contexte clinique</p>
              {Object.keys(statusCounts).length > 0 && (
                <div className="jrn-side-card__stats">
                  {statusCounts.prioritaire > 0 && (
                    <div className="jrn-side-stat jrn-side-stat--prioritaire">
                      <span className="jrn-side-stat__num">{statusCounts.prioritaire}</span>
                      <span className="jrn-side-stat__label">🔴 prio</span>
                    </div>
                  )}
                  {statusCounts.surveiller > 0 && (
                    <div className="jrn-side-stat jrn-side-stat--surveiller">
                      <span className="jrn-side-stat__num">{statusCounts.surveiller}</span>
                      <span className="jrn-side-stat__label">🟡 surv.</span>
                    </div>
                  )}
                  {statusCounts.optimal > 0 && (
                    <div className="jrn-side-stat jrn-side-stat--optimal">
                      <span className="jrn-side-stat__num">{statusCounts.optimal}</span>
                      <span className="jrn-side-stat__label">🟢 opt.</span>
                    </div>
                  )}
                </div>
              )}
              {topCategories.length > 0 && (
                <div className="jrn-side-card__axes">
                  <span className="jrn-side-card__sub-label">Axes</span>
                  <div className="jrn-side-card__axes-list">
                    {topCategories.map((cat) => (
                      <span key={cat.value} className={`jrn-cat-pill jrn-cat-pill--${cat.value}`}>
                        <span className="jrn-cat-pill__icon">{cat.icon}</span>
                        {cat.label}
                        <span className="jrn-cat-pill__count">·&nbsp;{cat.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Versions du protocole */}
          <div className="jrn-side-card">
            <p className="jrn-side-card__label">Versions du protocole</p>
            {versions.length === 0 ? (
              <p className="jrn-side-card__empty">Aucune version sauvegardée pour l'instant.</p>
            ) : (
              <ul className="jrn-side-versions">
                {versions.slice(0, 5).map((v, i) => {
                  const isLatest = i === 0;
                  const dateStr = v.createdAt
                    ? new Date(v.createdAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
                    : '—';
                  return (
                    <li key={v.id || i} className={`jrn-side-version ${isLatest ? 'jrn-side-version--latest' : ''}`}>
                      <span className="jrn-side-version__num">V{versions.length - i}</span>
                      <div className="jrn-side-version__body">
                        <span className="jrn-side-version__label">{v.label || (isLatest ? 'Version courante' : `Version V${versions.length - i}`)}</span>
                        <span className="jrn-side-version__date">{dateStr}</span>
                      </div>
                      {isLatest && <span className="jrn-side-version__badge">Active</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
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
  // AZ.2 : modification de la date de remise (migré du menu Plus dashboard)
  const [showEditDate, setShowEditDate] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  const handleSaveDeliveryDate = async () => {
    if (!newDeliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDeliveryDate)) {
      setErr('Date invalide');
      return;
    }
    setSavingDate(true);
    setErr(null);
    try {
      const iso = new Date(newDeliveryDate + 'T00:00:00').toISOString();
      const { error: updErr } = await supabase
        .from('clients')
        .update({ packStartedAt: iso, packStartedAtConfirmed: true })
        .eq('id', client.id);
      if (updErr) throw new Error(updErr.message);
      setShowEditDate(false);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur mise à jour date');
    } finally {
      setSavingDate(false);
    }
  };

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
          ? 'Le protocole est prêt. Anissa va le transmettre via les canaux activés ci-dessous. Un moment important du parcours.'
          : 'Vous adaptez son protocole. Par défaut, le nouveau plan est publié sur son app — sa lecture quotidienne reste fluide. Activez le format papier ci-dessous si ce cycle marque un changement majeur.'}
      />

      {/* BC.5 : refonte étape 7 en blocs numérotés (alignement étapes 1-6) */}

      {/* ─── Bloc 1 : Statut du cycle (contexte premier vs adaptation) ─ */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">1</span>
          <h3 className="jrn-block__title">
            {isFirstVersion ? 'Premier cycle — livret fondateur' : `Cycle ${versionsCount} — adaptation`}
          </h3>
          {!isFirstVersion && (
            <div className="jrn-block__head-meta">
              <span className="jrn-result-pill jrn-result-pill--optimal">version {versionsCount}</span>
            </div>
          )}
        </div>
        <p className="jrn-block__intro">
          {isFirstVersion
            ? 'Ce premier cycle ancre l\'expérience. Anissa transmet le livret papier (postal) + active l\'app cliente. La cliente reçoit son protocole personnalisé et l\'accès à son espace de suivi.'
            : 'Adaptation à partir des retours cliente. Par défaut publié sur l\'app uniquement (fluidité). Active le format papier si ce cycle est un changement majeur.'}
        </p>
      </div>

      {/* ─── Bloc 2 : Canaux de transmission (papier toggle) ─────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">2</span>
          <h3 className="jrn-block__title">Canaux de transmission</h3>
        </div>
        <p className="jrn-block__intro">
          Choisis quels formats Anissa transmet à la cliente pour ce cycle.
        </p>

        <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <PremiumSwitch checked={includePaper} onChange={setIncludePaper} />
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setIncludePaper(!includePaper)}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--jrn-text)', letterSpacing: '-0.005em' }}>
                📦 Livret papier postal pour ce cycle
              </div>
              <div style={{ fontSize: 13, color: 'var(--jrn-text-soft)', marginTop: 6, lineHeight: 1.55 }}>
                {isFirstVersion
                  ? 'Recommandé pour le premier cycle : livret fondateur premium qui ancre l\'expérience.'
                  : 'À activer uniquement pour les changements majeurs : nouveau cycle 4 semaines, refonte protocole, nouvelle phase (postpartum, sèche, etc.).'}
              </div>
            </div>
          </div>
        </div>

        {includePaper && (
          <div className="jrn-surface jrn-surface--quiet" style={{ marginBottom: 'var(--jrn-5)' }}>
            <div className="jrn-label" style={{ marginBottom: 'var(--jrn-3)' }}>📦 Marche à suivre — Plan papier</div>
            <ul style={{ margin: '0 0 var(--jrn-4)', paddingLeft: 20, color: 'var(--jrn-text-soft)', fontSize: 14, lineHeight: 1.8 }}>
              <li>Générer le document Word ci-dessous</li>
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
      </div>

      {/* ─── Bloc 3 : App cliente (suivi quotidien) ─────────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">3</span>
          <h3 className="jrn-block__title">App cliente</h3>
          <div className="jrn-block__head-meta">
            <span className="jrn-result-pill jrn-result-pill--optimal">📱 toujours active</span>
          </div>
        </div>
        <p className="jrn-block__intro">
          Le plan est disponible sur l'app dès la publication. La cliente reçoit une notification.
        </p>

        {/* Toggle suivi poids */}
        <div className="jrn-inline-card jrn-inline-card--accent">
          <div className="jrn-inline-card__row">
            <div className="jrn-inline-card__body">
              <div className="jrn-inline-card__title">⚖️ Suivi du poids</div>
              <div className="jrn-inline-card__hint">
                Si activé + visible : la cliente saisit son poids dans son ressenti quotidien.
              </div>
            </div>
            <WeightTogglesInline client={client} compact />
          </div>
        </div>

        {/* Astuce enrichissement IA */}
        <div className="jrn-inline-card jrn-inline-card--gold">
          <div className="jrn-inline-card__title">✨ Astuce — enrichir avant publication</div>
          <div className="jrn-inline-card__hint">
            Dans <strong>📱 Aperçu app</strong>, clique sur <strong>✨ Enrichir</strong> pour que l'IA ajoute une intro narrative personnalisée, des points clés et une signature pour la cliente. Recommandé pour la version V1.
          </div>
        </div>

        <p className="jrn-inline-card__cta-hint">
          → Clique sur <strong>📱 Aperçu app</strong> en haut à droite pour visualiser, enrichir et publier.
        </p>
      </div>

      {/* ─── Bloc 4 : Date de livraison (conditionnel — si déjà délivré) */}
      {client.packStartedAt && (
        <div className="jrn-block">
          <div className="jrn-block__head">
            <span className="jrn-block__num">4</span>
            <h3 className="jrn-block__title">Date de livraison enregistrée</h3>
          </div>
          <div className="jrn-surface" style={{ background: 'transparent', border: '1px dashed var(--jrn-border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--jrn-text-md)', color: 'var(--jrn-text)', fontWeight: 600, fontFamily: 'var(--jrn-font-display)', fontStyle: 'italic' }}>
                {new Date(client.packStartedAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              {!showEditDate && (
                <button
                  onClick={() => {
                    setNewDeliveryDate(new Date(client.packStartedAt).toISOString().slice(0, 10));
                    setShowEditDate(true);
                  }}
                  className="jrn-btn jrn-btn--ghost"
                  title="Corriger la date si erreur (la timeline du suivi démarre depuis cette date)"
                >
                  📅 Modifier
                </button>
              )}
            </div>
            {showEditDate && (
              <div style={{ marginTop: 'var(--jrn-4)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  value={newDeliveryDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    fontSize: 14,
                    border: '1px solid var(--jrn-border-strong)',
                    borderRadius: 'var(--jrn-radius-sm)',
                    fontFamily: 'inherit',
                  }}
                />
                <button onClick={handleSaveDeliveryDate} disabled={savingDate} className="jrn-btn jrn-btn--primary">
                  {savingDate ? '…' : 'Mettre à jour'}
                </button>
                <button onClick={() => setShowEditDate(false)} className="jrn-btn jrn-btn--ghost">
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Bloc final : Validation & livraison ──────────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">{client.packStartedAt ? '5' : '4'}</span>
          <h3 className="jrn-block__title">Confirmation de livraison</h3>
        </div>
        <p className="jrn-block__intro">
          {includePaper
            ? 'Une fois le livret papier expédié ET le plan publié sur l\'app, confirme la livraison. Cette action démarre la timeline du suivi (étape 8).'
            : 'Une fois le plan publié sur l\'app, confirme la livraison. Cette action démarre la timeline du suivi (étape 8).'}
        </p>
        <div className="jrn-actions" style={{ marginTop: 0 }}>
          <button onClick={handleDelivered} disabled={busy} className="jrn-btn jrn-btn--hero">
            {busy ? 'Livraison…' : (includePaper ? '🎁 Confirmer la livraison (papier + app) →' : '🎁 Confirmer la livraison →')}
          </button>
        </div>
      </div>

      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 8 — SUIVI
// ═══════════════════════════════════════════════════════════════════

function StepFollowup({ client, journey, onChange, onExit, onReturnPlan, onSendPackReview, onViewHistory }) {
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

  // Phase AK : extraction des pesees depuis les feedbacks deja charges
  // Une pesee = un feedback avec weight_kg non null (cf. migration weight_tracking).
  // On etend la fenetre a 90 jours pour avoir une vraie courbe d'evolution.
  const [weightEntries, setWeightEntries] = useState([]);
  const [loadingWeight, setLoadingWeight] = useState(true);
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { fetchClientFeedbacks } = await import('./services/fetchClientFeedbacks');
        const list = await fetchClientFeedbacks(client, 90);
        if (cancelled) return;
        const fbs = Array.isArray(list) ? list : (list?.feedbacks || []);
        const entries = fbs
          .filter((f) => typeof f.weight_kg === 'number')
          .map((f) => ({ date: f.date || f.created_at, weight_kg: Number(f.weight_kg) }))
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        setWeightEntries(entries);
      } catch {
        if (!cancelled) setWeightEntries([]);
      } finally {
        if (!cancelled) setLoadingWeight(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client?.id]);
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

      // V97.3 Phase C1 : tracking modification 'hybrid' (IA + feedbacks cliente)
      trackPlanModification({
        clientId: client.id,
        consultationId: lastConsult?.id,
        section: 'global',
        source: 'hybrid',
        versionId: `V${versionNum}`,
        beforeLength: currentPlan?.length || 0,
        afterLength: adaptedPlan?.length || 0,
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
        <div className="jrn-block">
          <div className="jrn-surface jrn-surface--quiet">
            <div className="jrn-empty">
              <div className="jrn-empty__icon">🔄</div>
              <p className="jrn-empty__title">Suivi non démarré</p>
              <p className="jrn-empty__hint">
                Le parcours initial est complet (livraison validée à l'étape 7). Active le cockpit de suivi pour commencer à logger les consultations, ressentis et adaptations.
              </p>
              <div className="jrn-actions" style={{ marginTop: 'var(--jrn-2)' }}>
                <button onClick={handleStart} disabled={busy} className="jrn-btn jrn-btn--hero">
                  {busy ? '…' : '🔄 Activer le suivi continu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {started && (
        <>
          {/* BC.5 Étape 8 : refonte en blocs numérotés (alignement étapes 1-7) */}

          {/* ─── Bloc 1 : Consultations ─────────────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">1</span>
              <h3 className="jrn-block__title">
                Consultations {consultationsTotal > 0 ? `· ${consultationsUsed}/${consultationsTotal}` : `· ${consultationsUsed}`}
              </h3>
              <div className="jrn-block__head-meta">
                <button
                  onClick={() => setShowLogModal(true)}
                  disabled={consultationsTotal > 0 && consultationsUsed >= consultationsTotal}
                  className="jrn-btn jrn-btn--soft"
                  title={consultationsTotal > 0 && consultationsUsed >= consultationsTotal ? 'Quota du pack atteint' : 'Marquer une nouvelle consultation effectuée'}
                >
                  ✅ Consultation effectuée
                </button>
              </div>
            </div>
            <p className="jrn-block__intro">
              Chaque RDV cabinet ou visio doit être enregistré ici. Le compteur alimente la timeline du pack et limite à la quantité incluse.
            </p>

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

          {/* ─── Bloc 2 : Suivi du poids ─────────────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">2</span>
              <h3 className="jrn-block__title">Suivi du poids{weightEntries.length > 0 ? ` · ${weightEntries.length} pesée${weightEntries.length > 1 ? 's' : ''}` : ''}</h3>
            </div>
            <WeightTrackingSection
              client={client}
              entries={weightEntries}
              loading={loadingWeight}
            />
          </div>

          {/* ─── Bloc 3 : Derniers ressentis ─────────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">3</span>
              <h3 className="jrn-block__title">Derniers ressentis · {feedbacks.length}</h3>
              <div className="jrn-block__head-meta">
                <span className="jrn-meta-chip jrn-meta-chip--neutral">14 derniers jours</span>
              </div>
            </div>
            <p className="jrn-block__intro">
              Les ressentis quotidiens de la cliente nourrissent l'adaptation IA du plan (bloc 4 ci-dessous).
            </p>
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

          {/* ─── Bloc 4 : Cycle de suivi — actions ─────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">4</span>
              <h3 className="jrn-block__title">Cycle de suivi — actions</h3>
            </div>
            <p className="jrn-block__intro">
              Cycle : <strong>Adapter</strong> (IA depuis ressentis) → <strong>Éditer</strong> (étape 6) → <strong>Republier</strong> (étape 7) → retour ici. Plan de reprise = relance après pause.
            </p>
            <div className="jrn-actions" style={{ marginTop: 0 }}>
              <button
                onClick={handleAdaptFromFeedback}
                disabled={adapting || feedbacks.length === 0}
                className="jrn-btn jrn-btn--hero"
                title={feedbacks.length === 0 ? 'Aucun ressenti à exploiter' : "L'IA adapte le plan en tenant compte des derniers ressentis cliente"}
              >
                {adapting ? 'Adaptation IA…' : '✨ Adapter le plan depuis les ressentis →'}
              </button>
              <button onClick={handleRestartEditing} disabled={busy} className="jrn-btn jrn-btn--soft">
                Éditer manuellement
              </button>
              {onReturnPlan && (
                <button
                  onClick={() => onReturnPlan(client)}
                  disabled={busy}
                  className="jrn-btn jrn-btn--ghost"
                  title="Génère un plan de reprise IA après une pause (vacances, événement, rechute)"
                >
                  🔁 Plan de reprise
                </button>
              )}
              {onViewHistory && (
                <button
                  onClick={() => onViewHistory(client.id)}
                  className="jrn-btn jrn-btn--ghost"
                  title="Voir l'historique complet des consultations passées"
                >
                  📋 Historique complet
                </button>
              )}
            </div>
          </div>

          {/* ─── Bloc 5 : Bilan pack 4 semaines ─────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">5</span>
              <h3 className="jrn-block__title">Bilan de cycle</h3>
            </div>
            <PackReviewSection client={client} onSendPackReview={onSendPackReview} />
          </div>

          {/* ─── Bloc 6 : Historique des versions ─────────────── */}
          {versions.length > 0 && (
            <div className="jrn-block">
              <div className="jrn-block__head">
                <span className="jrn-block__num">6</span>
                <h3 className="jrn-block__title">Historique des versions · {versions.length}</h3>
              </div>
              <p className="jrn-block__intro">
                Une nouvelle version est créée à chaque adaptation. La cliente voit uniquement la version active.
              </p>
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
            </div>
          )}

          {/* ─── Footer : Retour dashboard ─────────────────────── */}
          <div className="jrn-actions" style={{ marginTop: 'var(--jrn-6)' }}>
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

// ═══════════════════════════════════════════════════════════════════
// Section : Suivi du poids (étape 8 cockpit)
// ═══════════════════════════════════════════════════════════════════

// Composant factorisé : toggles tracking + visible (utilisé étape 7 ET étape 8)
// Source de vérité unique : clientAppConfig (API admin /api/admin/client-config)
function useClientWeightConfig(client) {
  const [config, setConfig] = useState(null);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [cfgError, setCfgError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchClientAppConfig } = await import('./services/clientAppConfig');
        const res = await fetchClientAppConfig(client);
        if (!cancelled) setConfig(res?.config || { weight_tracking_enabled: false, weight_visible_to_client: false });
      } catch (e) {
        if (!cancelled) setConfig({ weight_tracking_enabled: false, weight_visible_to_client: false });
      } finally {
        if (!cancelled) setLoadingCfg(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client?.id]);

  const toggleConfig = async (key) => {
    setUpdating(key === 'weight_tracking_enabled' ? 'tracking' : 'visible');
    setCfgError(null);
    try {
      const { updateClientAppConfig } = await import('./services/clientAppConfig');
      const updates = { [key]: !config?.[key] };
      if (key === 'weight_tracking_enabled' && config?.[key]) {
        updates.weight_visible_to_client = false;
      }
      const next = await updateClientAppConfig(client, updates);
      setConfig(next);
    } catch (e) {
      setCfgError(e?.message || 'Erreur mise à jour');
    } finally {
      setUpdating(null);
    }
  };

  return { config, loadingCfg, updating, cfgError, toggleConfig };
}

function WeightTogglesInline({ client, compact = false }) {
  const { config, loadingCfg, updating, cfgError, toggleConfig } = useClientWeightConfig(client);
  if (loadingCfg) return null;
  const trackingEnabled = !!config?.weight_tracking_enabled;
  const visibleToClient = !!config?.weight_visible_to_client;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleChip
          label={compact ? 'Tracking' : 'Tracking activé'}
          checked={trackingEnabled}
          onClick={() => toggleConfig('weight_tracking_enabled')}
          loading={updating === 'tracking'}
          title="Active le suivi du poids pour cette cliente"
        />
        {trackingEnabled && (
          <ToggleChip
            label={compact ? 'Visible cliente' : 'Visible cliente'}
            checked={visibleToClient}
            onClick={() => toggleConfig('weight_visible_to_client')}
            loading={updating === 'visible'}
            title="Affiche le champ poids dans l'app cliente (sinon réservé coach)"
          />
        )}
      </div>
      {cfgError && <div className="jrn-error" style={{ marginTop: 6 }}>⚠ {cfgError}</div>}
    </>
  );
}

function WeightTrackingSection({ client, entries, loading }) {
  // Hook factorisé pour la section étape 8 cockpit
  const { config, loadingCfg } = useClientWeightConfig(client);
  const trackingEnabled = !!config?.weight_tracking_enabled;
  const visibleToClient = !!config?.weight_visible_to_client;

  // Si tracking off ET pas de pesées historiques, on affiche quand même (pour permettre activation)
  const last = entries[0] || null;
  const oldest = entries[entries.length - 1] || null;
  const delta = last && oldest && entries.length > 1
    ? Number((last.weight_kg - oldest.weight_kg).toFixed(1))
    : null;

  return (
    <div style={{ marginBottom: 'var(--jrn-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--jrn-3)', flexWrap: 'wrap', gap: 8 }}>
        <p className="jrn-label" style={{ margin: 0 }}>
          Suivi du poids {entries.length > 0 ? `(${entries.length} pesée${entries.length > 1 ? 's' : ''})` : ''}
        </p>
        <WeightTogglesInline client={client} />
      </div>

      {(loading || loadingCfg) && (
        <div style={{ color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>Chargement…</div>
      )}

      {!loading && !loadingCfg && !trackingEnabled && entries.length === 0 && (
        <div className="jrn-surface jrn-surface--quiet" style={{ padding: 'var(--jrn-5)', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>
            Suivi du poids désactivé.<br />
            Cliquez sur <strong>Tracking activé</strong> ci-dessus pour l'activer pour cette cliente.
          </p>
        </div>
      )}

      {!loading && !loadingCfg && entries.length === 0 && trackingEnabled && (
        <div className="jrn-surface jrn-surface--quiet" style={{ padding: 'var(--jrn-5)', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--jrn-text-muted)', fontSize: 'var(--jrn-text-sm)' }}>
            {visibleToClient
              ? 'Suivi activé. La cliente peut saisir son poids depuis l\'app (champ visible dans son ressenti quotidien). Aucune pesée encore reçue.'
              : 'Suivi activé en mode coach (champ caché à la cliente). Aucune pesée enregistrée.'}
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="jrn-surface" style={{ padding: 'var(--jrn-5)' }}>
          {/* Header : dernière valeur + delta */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 'var(--jrn-4)' }}>
            <div>
              <div style={{ fontFamily: 'var(--jrn-font-display)', fontStyle: 'italic', fontSize: 36, fontWeight: 600, color: 'var(--jrn-text)', lineHeight: 1 }}>
                {last.weight_kg.toFixed(1)} <span style={{ fontSize: 18, color: 'var(--jrn-text-muted)', fontStyle: 'normal', fontWeight: 400 }}>kg</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--jrn-text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Dernière pesée — {last.date ? new Date(last.date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long' }) : ''}
              </div>
            </div>
            {delta !== null && (
              <div style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: delta > 0 ? 'rgba(184, 134, 38, 0.10)' : delta < 0 ? 'var(--jrn-accent-soft)' : 'rgba(0,0,0,0.04)',
                color: delta > 0 ? '#8a6722' : delta < 0 ? 'var(--jrn-accent)' : 'var(--jrn-text-muted)',
                fontSize: 12,
                fontWeight: 600,
              }}>
                {delta > 0 ? '↗' : delta < 0 ? '↘' : '→'} {delta > 0 ? '+' : ''}{delta} kg
                <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.8 }}>
                  sur {entries.length > 1 ? `${entries.length} pesées` : '1 pesée'}
                </span>
              </div>
            )}
          </div>

          {/* Sparkline SVG simple */}
          {entries.length >= 2 && (
            <Sparkline entries={entries} />
          )}

          {/* Liste des 6 dernières pesées */}
          <div style={{ marginTop: 'var(--jrn-4)' }}>
            <div style={{ fontSize: 10, color: 'var(--jrn-text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Historique récent
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
              {entries.slice(0, 6).map((e, i) => (
                <div key={i} style={{
                  padding: '8px 10px',
                  background: 'var(--jrn-surface-alt)',
                  border: '1px solid var(--jrn-border)',
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  <div style={{ color: 'var(--jrn-text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {e.date ? new Date(e.date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' }) : ''}
                  </div>
                  <div style={{ color: 'var(--jrn-text)', fontWeight: 500, marginTop: 2 }}>
                    {e.weight_kg.toFixed(1)} kg
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AR.2 : switch iOS-like premium (rail + bouton glissant), au lieu d'une
// chip avec checkmark. Plus reconnaissable visuellement comme "toggle".
function ToggleChip({ label, checked, onClick, loading, title }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      style={{
        fontFamily: 'var(--jrn-font-ui)',
        fontSize: 12,
        fontWeight: 500,
        padding: '6px 12px 6px 8px',
        borderRadius: 999,
        border: '1px solid transparent',
        background: 'transparent',
        color: checked ? 'var(--jrn-text)' : 'var(--jrn-text-muted)',
        cursor: loading ? 'wait' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        whiteSpace: 'nowrap',
        opacity: loading ? 0.6 : 1,
        transition: 'all 160ms var(--jrn-ease)',
      }}
    >
      {/* Switch iOS-like : rail 36×20 + thumb 16×16 qui glisse */}
      <span style={{
        position: 'relative',
        width: 34,
        height: 20,
        borderRadius: 999,
        background: checked ? 'var(--jrn-accent)' : 'rgba(40, 32, 20, 0.18)',
        boxShadow: checked
          ? 'inset 0 1px 2px rgba(15, 25, 18, 0.2)'
          : 'inset 0 1px 2px rgba(40, 32, 20, 0.1)',
        transition: 'background 160ms var(--jrn-ease), box-shadow 160ms var(--jrn-ease)',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.1)',
          transition: 'left 200ms var(--jrn-ease)',
        }} />
      </span>
      {label}
    </button>
  );
}

function Sparkline({ entries }) {
  // Tri chronologique ascendant pour le graphique
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const w = 600;
  const h = 80;
  const pad = 8;
  const values = sorted.map((e) => e.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - 2 * pad) / Math.max(1, sorted.length - 1);

  const points = sorted.map((e, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((e.weight_kg - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M ${pad},${h - pad} L ${points.split(' ').join(' L ')} L ${w - pad},${h - pad} Z`;

  return (
    <div style={{ marginTop: 'var(--jrn-3)' }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 80, display: 'block' }}>
        <path d={areaPath} fill="var(--jrn-accent-soft)" />
        <polyline points={points} fill="none" stroke="var(--jrn-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((e, i) => {
          const x = pad + i * stepX;
          const y = h - pad - ((e.weight_kg - min) / range) * (h - 2 * pad);
          return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--jrn-accent)" />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--jrn-text-muted)', marginTop: 4 }}>
        <span>{sorted[0]?.date ? new Date(sorted[0].date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' }) : ''}</span>
        <span style={{ color: 'var(--jrn-text-soft)' }}>min {min.toFixed(1)} · max {max.toFixed(1)}</span>
        <span>{sorted[sorted.length - 1]?.date ? new Date(sorted[sorted.length - 1].date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' }) : ''}</span>
      </div>
    </div>
  );
}

// AY : section Bilan pack 4 semaines — migrée du menu Plus du dashboard.
// Affiche le statut du prochain bilan dû selon le pack (S4 / S8 / S12 / S24)
// + bouton d'envoi + résumé du bilan reçu si déjà soumis.
function PackReviewSection({ client, onSendPackReview }) {
  const [status, setStatus] = useState('loading'); // loading | none | sent | submitted
  const [latestReview, setLatestReview] = useState(null);
  const [nextStep, setNextStep] = useState(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ getCycleReviews }, { getNextPendingStep, canSendPackReview }] = await Promise.all([
          import('./store'),
          import('./services/packSystem'),
        ]);
        const reviews = await getCycleReviews(client.id);
        if (cancelled) return;
        const next = getNextPendingStep(client);
        setNextStep(next);
        const sortedReviews = Array.isArray(reviews) ? [...reviews].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];
        const submitted = sortedReviews.find((r) => r.status === 'submitted');
        const sent = sortedReviews.find((r) => r.status === 'sent');
        if (submitted) {
          setStatus('submitted');
          setLatestReview(submitted);
        } else if (sent) {
          setStatus('sent');
          setLatestReview(sent);
        } else if (next && canSendPackReview(next)) {
          setStatus('none');
        } else {
          setStatus('none');
        }
      } catch {
        if (!cancelled) setStatus('none');
      }
    })();
    return () => { cancelled = true; };
  }, [client]);

  const handleSend = async () => {
    if (!nextStep || !onSendPackReview) return;
    setSending(true);
    setErr(null);
    try {
      await onSendPackReview(client, nextStep);
      setStatus('sent');
    } catch (e) {
      setErr(e?.message || 'Erreur envoi bilan');
    } finally {
      setSending(false);
    }
  };

  if (status === 'loading') return null;
  // Si pas de pack de suivi détecté → on cache la section
  const isFollowupPack = !!client?.packType?.startsWith('suivi');
  if (!isFollowupPack) return null;

  return (
    <div style={{ marginBottom: 'var(--jrn-6)' }}>
      <p className="jrn-label">Bilan 4 semaines</p>
      <div className="jrn-surface" style={{ padding: 'var(--jrn-6)' }}>
        {status === 'submitted' && latestReview && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'var(--jrn-accent-soft)',
                color: 'var(--jrn-accent)',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}>🟢 Bilan reçu</span>
              <span style={{ fontSize: 12, color: 'var(--jrn-text-muted)' }}>
                {latestReview.created_at ? new Date(latestReview.created_at).toLocaleDateString('fr-CH') : ''}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--jrn-text-soft)', margin: 0 }}>
              La cliente a soumis son bilan {latestReview.step_number ? `S${latestReview.step_number}` : ''}. Lecture du détail disponible via l'historique cliente.
            </p>
          </>
        )}

        {status === 'sent' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(184, 134, 38, 0.10)',
                color: '#8a6722',
                textTransform: 'uppercase',
                letterSpacing: '.04em',
              }}>🟡 Bilan en attente</span>
              {latestReview?.created_at && (
                <span style={{ fontSize: 12, color: 'var(--jrn-text-muted)' }}>
                  envoyé le {new Date(latestReview.created_at).toLocaleDateString('fr-CH')}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--jrn-text-soft)', margin: 0 }}>
              Le bilan a été envoyé à la cliente. En attente de sa soumission.
            </p>
          </>
        )}

        {status === 'none' && nextStep && (
          <>
            <p style={{ fontSize: 13, color: 'var(--jrn-text-soft)', margin: '0 0 12px' }}>
              Prochain bilan : <strong>{nextStep.label || `S${nextStep.stepNumber}`}</strong>
              {nextStep.dueDate && (
                <span style={{ color: 'var(--jrn-text-muted)' }}> · à envoyer {new Date(nextStep.dueDate).toLocaleDateString('fr-CH')}</span>
              )}
            </p>
            <button
              onClick={handleSend}
              disabled={sending || !onSendPackReview}
              className="jrn-btn jrn-btn--primary"
            >
              {sending ? 'Envoi…' : `📋 Envoyer bilan ${nextStep.label || `S${nextStep.stepNumber}`}`}
            </button>
          </>
        )}

        {status === 'none' && !nextStep && (
          <p style={{ fontSize: 13, color: 'var(--jrn-text-muted)', margin: 0, fontStyle: 'italic' }}>
            Aucun bilan en attente pour ce cycle.
          </p>
        )}

        {err && <div className="jrn-error" style={{ marginTop: 10 }}>⚠ {err}</div>}
      </div>
    </div>
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
