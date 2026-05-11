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
  const progressPct = Math.round((completedCount / JOURNEY_STEPS.length) * 100);
  const currentStepIndex = STEP_META[currentStep]?.index || 1;

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
          {currentStep === 'plan_editing' && <StepPlanEditing client={client} onChange={refresh} />}
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
          ? 'Votre cliente reçoit maintenant son protocole personnalisé et l\'accès à son espace de suivi. Un moment important du parcours.'
          : 'Vous adaptez son protocole. Par défaut, le nouveau plan est publié sur son app — sa lecture quotidienne reste fluide. Activez le format papier ci-dessous si ce cycle marque un changement majeur.'}
      />

      {/* ─── Toggle papier (AU : switch premium au lieu de checkbox) ─ */}
      <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <PremiumSwitch checked={includePaper} onChange={setIncludePaper} />
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setIncludePaper(!includePaper)}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--jrn-text)', letterSpacing: '-0.005em' }}>
              📦 Plan papier nécessaire pour ce cycle
            </div>
            <div style={{ fontSize: 13, color: 'var(--jrn-text-soft)', marginTop: 6, lineHeight: 1.55 }}>
              {isFirstVersion
                ? 'Recommandé pour le premier cycle : livret fondateur premium qui ancre l\'expérience.'
                : 'À activer uniquement pour les changements majeurs : nouveau cycle 4 semaines, refonte protocole, nouvelle phase (postpartum, sèche, etc.).'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Section app cliente (toujours présente) ─────────────── */}
      <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)' }}>
        <div className="jrn-label">📱 App cliente</div>
        <p style={{ fontSize: 13, color: 'var(--jrn-text-soft)', marginTop: 6, marginBottom: 12, lineHeight: 1.55 }}>
          Le plan sera disponible sur l'app dès la publication. La cliente reçoit une notification.
        </p>

        {/* BC.5A : configuration suivi du poids — utilise jrn-inline-card accent */}
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

        {/* BC.5A : guide enrichissement IA — palette gold (au lieu de violet hors palette) */}
        <div className="jrn-inline-card jrn-inline-card--gold">
          <div className="jrn-inline-card__title">✨ Astuce — enrichir avant publication</div>
          <div className="jrn-inline-card__hint">
            Dans <strong>📱 Aperçu app</strong>, cliquez sur le bouton <strong>✨ Enrichir</strong> pour que l'IA ajoute une intro narrative personnalisée, des points clés et une signature pour la cliente. Recommandé pour la version V1 (livret fondateur).
          </div>
        </div>

        <p className="jrn-inline-card__cta-hint">
          → Cliquez sur <strong>📱 Aperçu app</strong> en haut à droite pour visualiser, enrichir et publier.
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

      {/* AZ.2 : Modification de la date de livraison (migré du menu Plus) */}
      {client.packStartedAt && (
        <div className="jrn-surface" style={{ marginBottom: 'var(--jrn-5)', background: 'transparent', border: '1px dashed var(--jrn-border-strong)', padding: 'var(--jrn-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="jrn-label" style={{ marginBottom: 2 }}>Date de livraison enregistrée</div>
              <div style={{ fontSize: 13, color: 'var(--jrn-text)', fontWeight: 500 }}>
                {new Date(client.packStartedAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
            {!showEditDate && (
              <button
                onClick={() => {
                  setNewDeliveryDate(new Date(client.packStartedAt).toISOString().slice(0, 10));
                  setShowEditDate(true);
                }}
                className="jrn-btn jrn-btn--ghost"
                style={{ fontSize: 12, padding: '6px 12px' }}
                title="Corriger la date si erreur (la timeline du suivi démarre depuis cette date)"
              >
                📅 Modifier
              </button>
            )}
          </div>
          {showEditDate && (
            <div style={{ marginTop: 'var(--jrn-3)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={newDeliveryDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setNewDeliveryDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  border: '1px solid var(--jrn-border-strong)',
                  borderRadius: 'var(--jrn-radius-sm)',
                  fontFamily: 'inherit',
                }}
              />
              <button onClick={handleSaveDeliveryDate} disabled={savingDate} className="jrn-btn jrn-btn--primary" style={{ padding: '8px 14px', fontSize: 12 }}>
                {savingDate ? '…' : 'Mettre à jour'}
              </button>
              <button onClick={() => setShowEditDate(false)} className="jrn-btn jrn-btn--ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
                Annuler
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hero CTA — moment important : la livraison est une étape clé */}
      <div style={{ marginTop: 'var(--jrn-10)', display: 'flex', justifyContent: 'center' }}>
        <button onClick={handleDelivered} disabled={busy} className="jrn-btn--hero">
          {busy ? 'Livraison…' : (includePaper ? '🎁 Confirmer la livraison (papier + app)' : '🎁 Confirmer la livraison')}
        </button>
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

          {/* ─── Section : suivi du poids ───────────────────────── */}
          <WeightTrackingSection
            client={client}
            entries={weightEntries}
            loading={loadingWeight}
          />

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

          {/* ─── Section : actions de cycle (AY : enrichie) ─────── */}
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
                Éditer manuellement
              </button>
              {/* AY : Plan de reprise (migré du menu Plus du dashboard) */}
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
              {/* AZ.3 : Voir historique complet des consultations (migré du menu Plus) */}
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
            <p style={{ marginTop: 'var(--jrn-2)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)' }}>
              Cycle : Adapter → Éditer (étape 6) → Republier (étape 7) → retour ici. Plan de reprise = relance après pause.
            </p>
          </div>

          {/* ─── Section : Bilan pack 4 semaines (AY : migré du menu Plus) ─── */}
          <PackReviewSection client={client} onSendPackReview={onSendPackReview} />


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
