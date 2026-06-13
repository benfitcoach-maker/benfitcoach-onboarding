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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { PACK_DEFINITIONS } from './services/packSystem';
import { isAnamneseFilled } from './services/anamneseAnalyzer';
import {
  JOURNEY_STEPS,
  STEP_META,
  DEFAULT_JOURNEY_STATE,
  getStepStatus,
  transitions,
  setPendingProtocolPhases,
  clearPendingProtocolPhases,
} from './services/journeyState';
import AnalysisSuggestionModal from './AnalysisSuggestionModal';
import AnalysisPlanCard from './AnalysisPlanCard';
import JourneyPlanEditor from './JourneyPlanEditor';
import ClientAppPreviewModal from './ClientAppPreviewModal';
import JourneyMessagesPanel from './JourneyMessagesPanel';
import JourneyNotesPanel from './JourneyNotesPanel';
import PremiumSwitch from './components/PremiumSwitch';
import SuiviCockpitTimeline from './components/SuiviCockpitTimeline';
import CockpitErrorBoundary from './components/CockpitErrorBoundary';
import ConsultationClinicalSummary from './components/ConsultationClinicalSummary';
import ClientPulseSummary from './components/ClientPulseSummary';
import ClinicalAlertBanner from './components/ClinicalAlertBanner';
import FeedbacksTrendChart from './components/FeedbacksTrendChart';
import { transitionToNextPhase, getActivePhase, bakePendingProtocolPhases } from './services/protocolPhases';
// V97.40 (roadmap 1.2) — propage email + client_id sur les appels app cliente.
import { clientIdentityFields } from './services/clientIdentity';
// V97.23 (V97.18 Phase E) — Auto-generation brouillon IA apres transition phase.
import { autoGeneratePlanForPhaseTransition } from './services/autoGeneratePlanForPhaseTransition';
// V97.4 V3.C — saisie dynamique des marqueurs attendus depuis le catalogue.
// Lecture seule du catalogue : la source de vérité reste journey_state.results_data.
import { getExpectedMarkersForTest } from './services/clinical/catalog/orthoAnalyticTests';
// P1.4 (remède sécurité clinique) — validation plausibilité saisie labo.
import { validateMarkerValue } from './services/clinical/catalog/markers';
// P2.1 (remède sécurité clinique) — état réel (panne vs vide) propagé aux signaux.
import { signalDisplayState } from './services/signalDisplayState';
import { getNutritionConsultations, saveNutritionConsultation } from './store';
import { trackPlanValidated, trackPlanModification } from './services/observability';
import './styles/journey.css';

export default function ClientJourneyPage({ clientId, onExit, onEditProfile, onReturnPlan, onSendPackReview, onViewHistory }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Phase T : aperçu app cliente (modal mockup téléphone)
  const [showAppPreview, setShowAppPreview] = useState(false);
  // V97.13.27 — flag pour auto-trigger Enrichir IA quand la modal s'ouvre.
  // Permet à Anissa de cliquer "Enrichir IA" depuis l'étape 7 (1 clic au lieu de 3).
  const [appPreviewAutoEnrich, setAppPreviewAutoEnrich] = useState(false);
  const [previewConsultation, setPreviewConsultation] = useState(null);
  // Phase AC : panel latéral messagerie SaaS ↔ cliente
  const [showMessages, setShowMessages] = useState(false);
  // Phase AE : panel latéral notes internes Anissa
  const [showNotes, setShowNotes] = useState(false);
  // V97.28 — Navigation libre dans la timeline une fois le parcours terminé.
  // viewedStepOverride permet à Anissa de cliquer sur une étape passée pour la
  // consulter (sans repasser par les validations). null = on suit current_step.
  // Reset automatiquement quand current_step change côté DB.
  const [viewedStepOverride, setViewedStepOverride] = useState(null);

  const openAppPreview = useCallback(async (options = {}) => {
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
    // V97.13.27 — option autoEnrich pour déclencher Enrichir IA immédiatement
    setAppPreviewAutoEnrich(!!options.autoEnrich);
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
    // V97.11.5 (2026-05-13) — Normalize Supabase snake_case → camelCase.
    // Avant ce fix, client.packType etait undefined (Supabase renvoie
    // pack_type), donc PACK_DEFINITIONS[undefined] retournait null,
    // donc la modal Suggestion analyses affichait "0 CHF" et l'IA
    // ne se declenchait jamais. Le store.js central faisait deja ce
    // mapping mais ClientJourneyPage l'ignorait en allant en direct.
    const normalized = data ? {
      ...data,
      packType: data.pack_type || null,
      packStartedAt: data.pack_started_at || null,
      packStartedAtConfirmed: data.pack_started_at_confirmed ?? false,
      packSchedule: data.pack_schedule || null,
      stagingClientId: data.staging_client_id || null,
      createdBy: data.created_by || 'benoit',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      latestSections: data.latest_sections || null,
      interviewNotes: data.interview_notes || null,
    } : null;
    setClient(normalized);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadClient(); }, [loadClient]);

  // V97.28 — Reset override quand current_step change côté DB (ex : Anissa
  // a validé une étape via flèche retour pendant qu'elle consultait, ou un
  // refresh a ramené un nouveau current_step). On suit la DB par défaut.
  useEffect(() => {
    setViewedStepOverride(null);
  }, [client?.journey_state?.current_step]);

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
  // V97.28 — viewedStep = ce qu'Anissa regarde. Par défaut = currentStep, mais
  // si elle a cliqué sur une étape passée dans la timeline (parcours fini),
  // l'override prend la main. La DB n'est jamais modifiée par cette navigation.
  const viewedStep = viewedStepOverride || currentStep;
  const isViewingPast = viewedStepOverride !== null && viewedStepOverride !== currentStep;

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
  // Jour J du pack — V97.8.1 : ne s'affiche QUE si le pack est confirmé démarré
  // (= markDelivered effectué). Avant ce fix, on calculait depuis packStartedAt
  // posé à la création → Anissa voyait 'Jour 1 du pack' avant le RDV.
  const daysSincePack = client.packStartedAt && client.packStartedAtConfirmed === true
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
              // V97.28 — "active" reflète maintenant ce que regarde Anissa,
              // pas l'état DB. La step réellement courante (currentStep) garde
              // un style visuel distinct via la classe --current.
              const isViewed = step === viewedStep;
              const isCurrent = step === currentStep;
              // Cliquable uniquement quand parcours complet (mode followup
              // démarré) ET sur une étape déjà passée différente de la courante.
              const isClickable = isParcoursComplete
                && step !== currentStep
                && (status === 'validated' || status === 'skipped');
              const cls = ['jrn-step'];
              if (isViewed) cls.push('jrn-step--active');
              else if (status === 'validated') cls.push('jrn-step--validated');
              else if (status === 'skipped') cls.push('jrn-step--skipped');
              if (isCurrent && !isViewed) cls.push('jrn-step--current-hint');
              if (isClickable) cls.push('jrn-step--clickable');
              // V97.8.1 (2026-05-12) : pastille notification sur l'étape
              // Onboarding si la cliente a soumis son pré-questionnaire mais
              // que l'anamnèse n'est pas encore validée. Anissa voit ainsi
              // immédiatement qu'il y a quelque chose à lire/gérer.
              const f = client.form || {};
              const preQReceived = !!(f.objectif_primaire || f.dureeProbleme || f.ressentiDigestion);
              const showPreQDot = step === 'anamnesis'
                && preQReceived
                && !journey.anamnesis_validated;
              const handleClick = isClickable ? () => setViewedStepOverride(step) : undefined;
              const title = isClickable
                ? `Consulter cette étape (lecture seule — n'altère pas le suivi)`
                : isCurrent ? 'Étape actuelle' : undefined;
              return (
                <div
                  key={step}
                  className={cls.join(' ')}
                  onClick={handleClick}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewedStepOverride(step); } } : undefined}
                  title={title}
                  style={isClickable ? { cursor: 'pointer' } : undefined}
                >
                  <span className="jrn-step__num">
                    {status === 'validated' ? '✓' : status === 'skipped' ? '↷' : meta.index}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {meta.label}
                    {showPreQDot && (
                      <span
                        title="Pré-questionnaire reçu — à lire avant le RDV"
                        style={{
                          display: 'inline-block',
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--jrn-accent)',
                          boxShadow: '0 0 0 3px rgba(46, 78, 56, 0.15)',
                        }}
                      />
                    )}
                    {isCurrent && !isViewed && (
                      <span
                        title="Étape actuelle"
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--jrn-accent)',
                          padding: '1px 6px',
                          border: '1px solid var(--jrn-accent)',
                          borderRadius: 999,
                          marginLeft: 2,
                        }}
                      >
                        ici
                      </span>
                    )}
                  </span>
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
                {(() => {
                  // V97.11.2 — Auto-detection : si la cliente a soumis le pre-q,
                  // elle EST sur l'app, peu importe la valeur du flag app_enabled.
                  const f = client.form || {};
                  const preQReceived = !!(f.objectif_primaire || f.dureeProbleme || f.ressentiDigestion);
                  const effActive = client.app_enabled || preQReceived;
                  return (
                    <span className={`jrn-cockpit__pill ${effActive ? 'jrn-cockpit__pill--on' : 'jrn-cockpit__pill--off'}`}>
                      {effActive ? 'Activée' : 'Non activée'}
                    </span>
                  );
                })()}
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
            autoEnrich={appPreviewAutoEnrich}
            onClose={() => { setShowAppPreview(false); setAppPreviewAutoEnrich(false); }}
            // V97.13.37 — Acces direct au panel Messages depuis la modal
            onOpenMessages={() => setShowMessages(true)}
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
          {/* V97.28 — Bandeau divergence : Anissa consulte une étape passée
              pendant que le suivi continue. Évite toute confusion sur l'état
              réel + bouton de retour rapide à l'étape courante. */}
          {isViewingPast && (
            <div style={{
              marginBottom: 16,
              padding: '10px 14px',
              background: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 12.5, color: '#5a4290', flex: 1, minWidth: 240 }}>
                <strong>Mode consultation.</strong>{' '}
                Vous regardez <em>{STEP_META[viewedStep]?.label || viewedStep}</em>.
                {' '}L'étape actuelle reste <strong>{STEP_META[currentStep]?.label || currentStep}</strong>{' '}
                — aucune modification ici n'altère le suivi en cours.
              </div>
              <button
                type="button"
                onClick={() => setViewedStepOverride(null)}
                className="jrn-btn jrn-btn--soft"
                style={{ background: 'white', borderColor: 'rgba(167, 139, 250, 0.4)', color: '#5a4290' }}
              >
                ← Revenir à l'étape actuelle
              </button>
            </div>
          )}
          {viewedStep === 'anamnesis' && <StepAnamnesis client={client} onChange={refresh} onEditProfile={onEditProfile} />}
          {viewedStep === 'analyses' && <StepAnalyses client={client} journey={journey} onChange={refresh} />}
          {viewedStep === 'waiting_results' && <StepWaitingResults client={client} onChange={refresh} />}
          {viewedStep === 'results' && <StepResults client={client} onChange={refresh} />}
          {viewedStep === 'plan_generation' && <StepPlanGeneration client={client} journey={journey} onChange={refresh} />}
          {viewedStep === 'plan_editing' && <StepPlanEditing client={client} journey={journey} onChange={refresh} />}
          {viewedStep === 'delivery' && <StepDelivery client={client} onChange={refresh} onOpenAppPreview={openAppPreview} />}
          {viewedStep === 'followup' && <StepFollowup client={client} journey={journey} onChange={refresh} onExit={onExit} onReturnPlan={onReturnPlan} onSendPackReview={onSendPackReview} onViewHistory={onViewHistory} onOpenAppPreview={openAppPreview} />}
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
function StepAnamnesis({ client, onChange, onEditProfile }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sendingQuestionnaire, setSendingQuestionnaire] = useState(null); // 'app' | 'link' | null
  // V97.4 — état local pour le CTA "Activer l'espace cliente" intégré
  // directement dans la carte App cliente (anciennement renvoyait vers Profil).
  const [activatingApp, setActivatingApp] = useState(false);
  const [activationError, setActivationError] = useState(null);
  // V97.10 — RDV anamnèse : Anissa pose la date du RDV après réception du
  // pré-q. La cliente la verra sur son app + recevra une notif J-1.
  const [rdvBusy, setRdvBusy] = useState(false);
  const [rdvDraft, setRdvDraft] = useState('');
  const [rdvNoteDraft, setRdvNoteDraft] = useState('');
  const [rdvEditMode, setRdvEditMode] = useState(false);
  const [rdvSyncWarning, setRdvSyncWarning] = useState(null);
  // V97.11 — Anamnèse approfondie : Anissa marque la fin du remplissage
  // explicitement (apres ou pendant le RDV). Timestamp dans journey_state.
  const [anamneseBusy, setAnamneseBusy] = useState(false);
  const form = client.form || {};
  const journey = client.journey_state || {};

  // V97.4 — Active l'app cliente in-place depuis l'onboarding étape 1.
  // Logique miroir de App.jsx ligne 1218 (création rapide) : POST
  // invite-client + update Supabase clients.app_enabled=true.
  // Best-effort : si l'invite échoue, on n'écrit pas app_enabled=true
  // et on affiche l'erreur à Anissa pour qu'elle puisse retry.
  const handleActivateApp = async () => {
    setActivatingApp(true);
    setActivationError(null);
    try {
      const email = client.form?.email || client.email;
      if (!email) throw new Error('Cliente sans email — impossible d\'activer l\'app');

      const { clientAppFetch } = await import('./services/clientAppFetch');
      const packType = client.packType || client.pack_type || '';
      const appMode = packType.startsWith('suivi_') ? 'followup' : 'oneshot';
      const saasOrigin = window.location.origin;

      const inviteRes = await clientAppFetch('/api/admin/invite-client', {
        method: 'POST',
        payload: {
          email,
          first_name: client.form?.prenom || client.prenom || 'Cliente',
          mode: appMode,
          questionnaire_url: `${saasOrigin}/questionnaire/${client.id}`,
        },
      });

      if (!inviteRes?.ok) {
        throw new Error(inviteRes?.error || 'L\'app cliente n\'a pas répondu correctement');
      }

      // Update local Supabase clients.app_enabled
      const { error: updErr } = await supabase
        .from('clients')
        .update({ app_enabled: true })
        .eq('id', client.id);
      if (updErr) throw new Error(updErr.message);

      onChange?.();
    } catch (e) {
      setActivationError(e?.message || 'Erreur d\'activation');
    } finally {
      setActivatingApp(false);
    }
  };

  // ─── Détection statuts ──────────────────────────────────────────
  // Réponses reçues : le form a au moins un champ clé rempli (objectifs/symptômes/pathologies/activité)
  // V97.8.1 (2026-05-12) : détection mise à jour pour matcher les champs
  // du pré-questionnaire app cliente (5 sections / 15 champs essentiels).
  // Avant ce fix, on cherchait des champs legacy SaaS (`objectifs` avec s,
  // `symptomes`, `activite`) qui ne sont pas remplis par le pre-q in-app.
  // Maintenant on accepte aussi les champs réellement remplis par Camille.
  // P1.1 (remède sécurité clinique, 2026-06-10) — délègue à la source unique
  // isAnamneseFilled (anamneseAnalyzer). Même prédicat qu'avant (champs pré-q
  // V97.8.1 + legacy SaaS), désormais partagé avec le gate de génération IA
  // pour qu'aucun chemin ne juge la complétude différemment.
  const minimallyFilled = isAnamneseFilled(form);
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

  // V97.10 — Handlers RDV anamnèse
  const formatRdv = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('fr-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const timePart = d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} à ${timePart}`;
  };

  const isoToDatetimeLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSaveRdv = async () => {
    if (!rdvDraft) return;
    setRdvBusy(true); setErr(null);
    try {
      const isoAt = new Date(rdvDraft).toISOString();
      const noteOrNull = rdvNoteDraft.trim() || null;

      // 1. Sauvegarde dans le SaaS (journey_state JSONB)
      const { updateJourneyState } = await import('./services/journeyState');
      await updateJourneyState(client.id, {
        rdv_anamnesis_at: isoAt,
        rdv_anamnesis_note: noteOrNull,
      });

      // 2. V97.10 Phase B : push vers app cliente pour que la cliente voie
      //    la date sur sa timeline (/parcours rdv_scheduled).
      //    V97.10.2 : on enchaine avec une notif push immediate ("RDV fixe").
      //    Best-effort sur les 2 etapes — le SaaS reste source de verite si
      //    l'app cliente est down.
      setRdvSyncWarning(null);
      try {
        const email = client.form?.email || client.email;
        if (!email) {
          throw new Error('Cliente sans email — sync impossible');
        }
        const { clientAppFetch } = await import('./services/clientAppFetch');
        // 2a. Pousse la date dans clients.rdv_scheduled_at
        await clientAppFetch('/api/admin/client-journey-status', {
          method: 'POST',
          payload: {
            ...clientIdentityFields(client),
            rdv_scheduled_at: isoAt,
          },
        });
        // 2b. Envoie une notif push immediate (best-effort separe — si la
        //     cliente n'a pas active les push, on ignore silencieusement).
        try {
          await clientAppFetch('/api/admin/push/send', {
            method: 'POST',
            payload: {
              ...clientIdentityFields(client),
              title: 'Votre RDV avec Anissa est fixé',
              body: `Rendez-vous d'anamnèse : ${formatRdv(isoAt)}.`,
              url: '/parcours',
              tag: 'rdv-anamnese',
            },
          });
        } catch (pushErr) {
          // eslint-disable-next-line no-console
          console.warn('[rdv-push] failed (non-bloquant):', pushErr?.message || pushErr);
        }
      } catch (syncErr) {
        const msg = syncErr?.message || String(syncErr);
        // eslint-disable-next-line no-console
        console.warn('[rdv-sync] failed:', msg, syncErr);
        setRdvSyncWarning(`RDV sauvegardé côté SaaS, mais sync app cliente échouée : ${msg}`);
      }

      setRdvEditMode(false);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur sauvegarde RDV');
    } finally {
      setRdvBusy(false);
    }
  };

  const handleEditRdv = () => {
    setRdvDraft(isoToDatetimeLocal(journey.rdv_anamnesis_at));
    setRdvNoteDraft(journey.rdv_anamnesis_note || '');
    setRdvEditMode(true);
  };

  // V97.11 — Handlers anamnèse approfondie
  const handleMarkAnamneseComplete = async () => {
    setAnamneseBusy(true); setErr(null);
    try {
      const { updateJourneyState } = await import('./services/journeyState');
      await updateJourneyState(client.id, {
        anamnesis_completed_at: new Date().toISOString(),
      });
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur marquage anamnèse');
    } finally {
      setAnamneseBusy(false);
    }
  };

  const handleUnmarkAnamneseComplete = async () => {
    if (!window.confirm('Repasser l\'anamnèse en "à compléter" ?')) return;
    setAnamneseBusy(true); setErr(null);
    try {
      const { updateJourneyState } = await import('./services/journeyState');
      await updateJourneyState(client.id, {
        anamnesis_completed_at: null,
      });
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur démarquage anamnèse');
    } finally {
      setAnamneseBusy(false);
    }
  };

  const handleClearRdv = async () => {
    if (!window.confirm('Annuler ce RDV ? La cliente ne le verra plus sur son app.')) return;
    setRdvBusy(true); setErr(null);
    try {
      // 1. Clear dans le SaaS
      const { updateJourneyState } = await import('./services/journeyState');
      await updateJourneyState(client.id, {
        rdv_anamnesis_at: null,
        rdv_anamnesis_note: null,
      });

      // 2. Clear cote app cliente
      setRdvSyncWarning(null);
      try {
        const email = client.form?.email || client.email;
        if (!email) {
          throw new Error('Cliente sans email — sync impossible');
        }
        const { clientAppFetch } = await import('./services/clientAppFetch');
        await clientAppFetch('/api/admin/client-journey-status', {
          method: 'POST',
          payload: {
            email,
            rdv_scheduled_at: null,
          },
        });
      } catch (syncErr) {
        const msg = syncErr?.message || String(syncErr);
        // eslint-disable-next-line no-console
        console.warn('[rdv-sync clear] failed:', msg, syncErr);
        setRdvSyncWarning(`RDV effacé côté SaaS, mais sync app cliente échouée : ${msg}`);
      }

      setRdvEditMode(false);
      setRdvDraft('');
      setRdvNoteDraft('');
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur annulation RDV');
    } finally {
      setRdvBusy(false);
    }
  };

  const hasEmail = !!(client.form?.email || client.email);

  // V97.11.2 — Auto-detection app cliente active.
  // Le flag client.app_enabled (SaaS) peut etre stale depuis V97.9 (creation
  // decouplee). Si la cliente a soumis le pre-questionnaire, elle EST sur
  // l'app (l'OTP login + submission etablit une session). Donc on considere
  // l'app active dans ce cas, peu importe la valeur du flag.
  const appEffectivelyActive = client.app_enabled || questionnaireReceived;

  return (
    <section>
      <StepHead
        index={1}
        title="Onboarding cliente"
        intro="Configurez l'expérience cliente, envoyez le pré-questionnaire, recueillez les réponses, puis validez pour lancer le parcours."
      />

      {/* ═══ BLOC 1 — Mode d'accompagnement ════════════════════════
          V97.11.2 : mode compact quand pre-q recu. Les 3 cards lourdes
          ne servent qu'au tout debut (cliente fraichement creee). Une
          fois la cliente engagee, on resume sur une ligne. */}
      {questionnaireReceived ? (
        // ─── Mode compact (cliente deja active) ──────────────────
        <div style={{ marginBottom: 'var(--jrn-6)' }}>
          <p className="jrn-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--jrn-accent)', fontWeight: 700 }}>✓</span>
            1 · Mode d'accompagnement
          </p>
          <div className="jrn-surface" style={{
            padding: 'var(--jrn-4) var(--jrn-5)',
            opacity: 0.92,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--jrn-3)', fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>📱</span>
                <strong style={{ color: 'var(--jrn-text)' }}>App cliente</strong>
                <span style={{ color: 'var(--jrn-accent)', fontWeight: 600 }}>· Active</span>
              </span>
              <span style={{ color: 'var(--jrn-text-muted)' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>⚖️</span>
                <strong style={{ color: 'var(--jrn-text)' }}>Suivi poids</strong>
                <span style={{ color: 'var(--jrn-text-muted)' }}>· à configurer étape 7</span>
              </span>
              <span style={{ color: 'var(--jrn-text-muted)' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>📦</span>
                <strong style={{ color: 'var(--jrn-text)' }}>Plan papier</strong>
                <span style={{ color: 'var(--jrn-text-muted)' }}>· à confirmer étape 7</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
      // ─── Mode complet (cliente fraichement creee, rien de fait) ──
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
              status={appEffectivelyActive ? 'active' : 'inactive'}
              hint={appEffectivelyActive
                ? 'Activée — la cliente peut se connecter via son lien reçu par email.'
                : 'Inactive — clique sur "Activer" pour créer son espace et lui envoyer le magic link.'}
              ctaLabel={appEffectivelyActive ? null : 'Activer l\'espace cliente'}
              onCtaClick={appEffectivelyActive ? null : handleActivateApp}
              ctaBusy={activatingApp}
              ctaError={activationError}
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
      )}

      {/* ═══ BLOC 2 — Pré-questionnaire ════════════════════════════
          V97.10 : on masque ce bloc une fois les réponses reçues
          (les boutons d'envoi n'ont plus de sens). Le bloc Réponses
          reçues (BLOC 3) prend le relais. */}
      {!questionnaireReceived && (
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
      )}

      {/* ═══ BLOC 3 — Réponses reçues ══════════════════════════════
          V97.10 : renumérotation dynamique — quand BLOC 2 est masqué
          (réponses reçues), ce bloc devient logiquement le n°2.
          V97.11.1 : opacity légère + check inline quand reçues pour
          signaler "déjà fait" sans le rendre criard. */}
      <div style={{ marginBottom: 'var(--jrn-6)', opacity: questionnaireReceived ? 0.92 : 1 }}>
        <p className="jrn-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {questionnaireReceived && <span style={{ color: 'var(--jrn-accent)', fontWeight: 700 }}>✓</span>}
          {questionnaireReceived ? '2' : '3'} · Réponses reçues
        </p>
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
              {/* V97.8.1 (2026-05-12) : affichage des champs réellement remplis
                  par le pré-questionnaire app cliente. On affiche le résumé
                  clinique essentiel — pas la totalité (Anissa creusera au RDV).
                  Champs legacy gardés en fallback si Anissa avait saisi
                  manuellement. */}
              <div className="jrn-kv">
                <div className="jrn-kv__k">Objectif principal</div>
                <div className={`jrn-kv__v ${form.objectif_primaire || form.objectifs ? '' : 'jrn-kv__v--empty'}`}>
                  {form.objectif_primaire || form.objectifs || 'non renseigné'}
                </div>
                <div className="jrn-kv__k">Depuis combien de temps</div>
                <div className={`jrn-kv__v ${form.dureeProbleme ? '' : 'jrn-kv__v--empty'}`}>
                  {form.dureeProbleme || 'non renseigné'}
                </div>
                <div className="jrn-kv__k">Urgence</div>
                <div className={`jrn-kv__v ${form.objectif_urgency ? '' : 'jrn-kv__v--empty'}`}>
                  {form.objectif_urgency === 'urgent_moins_1m' ? 'Urgent (< 1 mois)'
                    : form.objectif_urgency === 'moyen_3_6m' ? 'Moyen terme (3–6 mois)'
                    : form.objectif_urgency === 'long_terme' ? 'Long terme (transformation durable)'
                    : 'non renseigné'}
                </div>
                <div className="jrn-kv__k">Digestion ressentie</div>
                <div className={`jrn-kv__v ${form.ressentiDigestion ? '' : 'jrn-kv__v--empty'}`}>
                  {form.ressentiDigestion === 'Confortable' ? 'Confortable'
                    : form.ressentiDigestion === 'Inconfort_occasionnel' ? 'Inconfort occasionnel'
                    : form.ressentiDigestion === 'Inconfort_frequent' ? 'Inconfort fréquent'
                    : form.ressentiDigestion === 'Inconfort_quotidien' ? 'Inconfort quotidien'
                    : 'non renseigné'}
                </div>
                <div className="jrn-kv__k">Énergie au quotidien</div>
                <div className={`jrn-kv__v ${form.energieJournee ? '' : 'jrn-kv__v--empty'}`}>
                  {form.energieJournee || 'non renseigné'}
                </div>
                <div className="jrn-kv__k">Pathologies</div>
                <div className={`jrn-kv__v ${form.pathologies ? '' : 'jrn-kv__v--empty'}`}>
                  {form.pathologies || 'aucune signalée'}
                </div>
                <div className="jrn-kv__k">Traitements</div>
                <div className={`jrn-kv__v ${form.traitements ? '' : 'jrn-kv__v--empty'}`}>
                  {form.traitements || 'aucun signalé'}
                </div>
                <div className="jrn-kv__k">Allergies</div>
                <div className={`jrn-kv__v ${form.allergies ? '' : 'jrn-kv__v--empty'}`}>
                  {form.allergies || 'aucune signalée'}
                </div>
                <div className="jrn-kv__k">Cycle hormonal</div>
                <div className={`jrn-kv__v ${form.grossesseActuelle || form.contraception ? '' : 'jrn-kv__v--empty'}`}>
                  {(() => {
                    const parts = [];
                    if (form.grossesseActuelle && form.grossesseActuelle !== 'Non') parts.push(form.grossesseActuelle);
                    if (form.contraception) parts.push(`Contraception : ${form.contraception}`);
                    return parts.length > 0 ? parts.join(' · ') : 'non renseigné';
                  })()}
                </div>
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

      {/* ═══ BLOC RDV anamnèse (V97.10) ════════════════════════════
          Visible une fois les réponses du pré-q reçues. Anissa fixe la
          date du RDV, la cliente la verra sur son app + recevra une
          notif J-1 (extension cron V97.11.2, à wirer Phase B).
          V97.11.1 : surface visuellement accent quand RDV fixe — devient
          le "point chaud" de l'etape Onboarding. */}
      {questionnaireReceived && (
        <div style={{ marginBottom: 'var(--jrn-6)' }}>
          <p className="jrn-label">3 · RDV anamnèse</p>
          <p style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginTop: 4, marginBottom: 'var(--jrn-3)', lineHeight: 1.55 }}>
            Fixez la date du rendez-vous. La cliente le verra sur son app.
          </p>
          <div className="jrn-surface" style={{
            padding: 'var(--jrn-6)',
            ...(journey.rdv_anamnesis_at && !rdvEditMode ? {
              borderLeft: '3px solid var(--jrn-accent)',
              background: 'linear-gradient(90deg, rgba(46, 78, 56, 0.04) 0%, transparent 60%)',
            } : {}),
          }}>
            {(!journey.rdv_anamnesis_at || rdvEditMode) ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--jrn-3)', marginBottom: 'var(--jrn-3)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginBottom: 4 }}>
                      Date et heure
                    </label>
                    <input
                      type="datetime-local"
                      value={rdvDraft}
                      onChange={(e) => setRdvDraft(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid var(--jrn-border)',
                        borderRadius: 6,
                        background: 'var(--jrn-surface-2, transparent)',
                        color: 'inherit',
                        fontSize: 'var(--jrn-text-sm)',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginBottom: 4 }}>
                      Note (optionnel)
                    </label>
                    <input
                      type="text"
                      value={rdvNoteDraft}
                      onChange={(e) => setRdvNoteDraft(e.target.value)}
                      placeholder="Cabinet, visio Zoom, téléphone…"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid var(--jrn-border)',
                        borderRadius: 6,
                        background: 'var(--jrn-surface-2, transparent)',
                        color: 'inherit',
                        fontSize: 'var(--jrn-text-sm)',
                      }}
                    />
                  </div>
                </div>
                <div className="jrn-actions" style={{ marginTop: 0 }}>
                  <button
                    onClick={handleSaveRdv}
                    disabled={rdvBusy || !rdvDraft}
                    className="jrn-btn jrn-btn--primary"
                  >
                    {rdvBusy ? '…' : 'Confirmer le RDV'}
                  </button>
                  {rdvEditMode && (
                    <button
                      onClick={() => setRdvEditMode(false)}
                      disabled={rdvBusy}
                      className="jrn-btn jrn-btn--ghost"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div>
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
                    📅 RDV prévu
                  </span>
                  <span style={{ fontSize: 'var(--jrn-text-md)', fontWeight: 600 }}>
                    {formatRdv(journey.rdv_anamnesis_at)}
                  </span>
                  {journey.rdv_anamnesis_note && (
                    <span style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-muted)' }}>
                      · {journey.rdv_anamnesis_note}
                    </span>
                  )}
                </div>
                <div className="jrn-actions" style={{ marginTop: 'var(--jrn-3)' }}>
                  <button
                    onClick={handleEditRdv}
                    disabled={rdvBusy}
                    className="jrn-btn jrn-btn--ghost"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    Modifier
                  </button>
                  <button
                    onClick={handleClearRdv}
                    disabled={rdvBusy}
                    className="jrn-btn jrn-btn--ghost"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    Annuler le RDV
                  </button>
                </div>
              </div>
            )}
            {rdvSyncWarning && (
              <p style={{
                marginTop: 'var(--jrn-3)',
                fontSize: 'var(--jrn-text-sm)',
                color: 'var(--jrn-warn, #b8861f)',
                background: 'rgba(184, 134, 38, 0.08)',
                padding: '8px 12px',
                borderRadius: 6,
                lineHeight: 1.5,
              }}>
                ⚠ {rdvSyncWarning}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ BLOC Anamnèse approfondie (V97.11) ═══════════════════
          Visible une fois les réponses du pré-q reçues (typiquement
          remplie pendant ou après le RDV anamnèse). Timestamp explicite
          journey_state.anamnesis_completed_at marque la fin par Anissa. */}
      {questionnaireReceived && (
        <div style={{ marginBottom: 'var(--jrn-6)' }}>
          <p className="jrn-label">4 · Anamnèse approfondie</p>
          <p style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginTop: 4, marginBottom: 'var(--jrn-3)', lineHeight: 1.55 }}>
            Pendant ou après le RDV, complète l'anamnèse approfondie : sommeil, sport, antibiotiques, transit, glycémie, mode de vie…
          </p>
          <div className="jrn-surface" style={{
            padding: 'var(--jrn-6)',
            ...(journey.anamnesis_completed_at ? {
              borderLeft: '3px solid var(--jrn-accent)',
              background: 'linear-gradient(90deg, rgba(46, 78, 56, 0.04) 0%, transparent 60%)',
            } : {}),
          }}>
            {journey.anamnesis_completed_at ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jrn-3)', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: 'var(--jrn-accent)',
                    color: 'var(--jrn-ivory, #f5f0e8)',
                    letterSpacing: '.02em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    ✓ Anamnèse complétée
                  </span>
                  <span style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', fontWeight: 500 }}>
                    le {new Date(journey.anamnesis_completed_at).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="jrn-actions" style={{ marginTop: 'var(--jrn-3)' }}>
                  {onEditProfile && (
                    <button
                      onClick={onEditProfile}
                      disabled={anamneseBusy}
                      className="jrn-btn jrn-btn--ghost"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      Modifier
                    </button>
                  )}
                  <button
                    onClick={handleUnmarkAnamneseComplete}
                    disabled={anamneseBusy}
                    className="jrn-btn jrn-btn--ghost"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    Repasser en cours
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--jrn-3)', marginBottom: 'var(--jrn-3)' }}>
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
                    🟡 À compléter
                  </span>
                  <span style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-muted)' }}>
                    Marque comme complétée une fois que tu as fini de remplir les champs.
                  </span>
                </div>
                <div className="jrn-actions" style={{ marginTop: 0 }}>
                  {onEditProfile && (
                    <button onClick={onEditProfile} className="jrn-btn jrn-btn--primary">
                      Compléter l'anamnèse
                    </button>
                  )}
                  <button
                    onClick={handleMarkAnamneseComplete}
                    disabled={anamneseBusy}
                    className="jrn-btn jrn-btn--soft"
                  >
                    {anamneseBusy ? '…' : 'Marquer comme complétée'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ BLOC Validation onboarding (CTA final) ═══════════ */}
      <div style={{ marginBottom: 'var(--jrn-6)' }}>
        <p className="jrn-label">{questionnaireReceived ? '5' : '4'} · Validation</p>
        <p style={{ fontSize: 'var(--jrn-text-sm)', color: 'var(--jrn-text-soft)', marginTop: 4, marginBottom: 'var(--jrn-3)', lineHeight: 1.55 }}>
          Une fois le RDV anamnèse fait et les informations clés vérifiées, validez pour passer à l'étape Analyses.
        </p>
        {/* V97.11.1 : warning doux ton clinique premium (non-bloquant). */}
        {questionnaireReceived && !journey.anamnesis_completed_at && (
          <p style={{
            marginBottom: 'var(--jrn-3)',
            fontSize: 'var(--jrn-text-sm)',
            color: '#6b5018',
            background: 'rgba(184, 134, 38, 0.06)',
            border: '1px solid rgba(184, 134, 38, 0.18)',
            padding: '10px 14px',
            borderRadius: 8,
            lineHeight: 1.55,
            fontStyle: 'italic',
          }}>
            L'anamnèse approfondie n'a pas encore été finalisée. Tu peux continuer si l'entretien clinique est terminé.
          </p>
        )}
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
// V97.4 (2026-05-12) : ajout props optionnelles ctaLabel + onCtaClick +
// ctaBusy + ctaError pour transformer la carte d'un affichage passif en
// CTA opérationnel. Utilisé pour activer l'app cliente directement depuis
// l'onboarding étape 1 sans passer par le bouton Profil (= ancien doublon UX).
function OnboardingOption({ icon, title, description, status, hint, ctaLabel, onCtaClick, ctaBusy, ctaError }) {
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
        {/* V97.4 — CTA fonctionnel quand on a un callback (typiquement
            "Activer l'espace cliente" pour App cliente inactive). */}
        {ctaLabel && onCtaClick && (
          <div style={{ marginTop: 'var(--jrn-3)' }}>
            <button
              type="button"
              onClick={onCtaClick}
              disabled={ctaBusy}
              className="jrn-btn jrn-btn--soft"
              style={{ fontSize: 13 }}
            >
              {ctaBusy ? '…' : ctaLabel}
            </button>
            {ctaError && (
              <div style={{ marginTop: 'var(--jrn-2)', fontSize: 12, color: 'var(--jrn-error, #b22222)' }}>
                {ctaError}
              </div>
            )}
          </div>
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
        intro="Suggestion algorithmique d'analyses pertinentes selon l'anamnèse et le pack acheté. À vous de valider ou d'écarter chaque proposition."
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
            ? 'Lance l\'analyse algorithmique pour proposer un plan d\'analyses adapté à l\'anamnèse. Tu valideras ensuite chaque test individuellement avant prescription.'
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

        {hasPlan === false && (() => {
          // V97.8.1 (2026-05-13) : 3 sous-états selon l'avancement de
          // l'onboarding. Avant ce fix, on proposait 'Lancer la suggestion IA'
          // dès l'étape 2, même si la cliente n'avait pas rempli son
          // pré-questionnaire — l'IA aurait alors rien à exploiter.
          const f = client.form || {};
          const preQReceived = !!(f.objectif_primaire || f.dureeProbleme || f.ressentiDigestion);
          const anamnesisValidated = journey?.anamnesis_validated === true;

          // État A : pré-q pas encore rempli par la cliente
          if (!preQReceived) {
            return (
              <div className="jrn-surface jrn-surface--quiet">
                <div className="jrn-empty">
                  <div className="jrn-empty__icon">⏳</div>
                  <p className="jrn-empty__title">En attente du pré-questionnaire</p>
                  <p className="jrn-empty__hint">
                    La cliente n&apos;a pas encore rempli son pré-questionnaire dans l&apos;app.
                    Une fois reçu, tu pourras valider l&apos;anamnèse à l&apos;étape 1, puis
                    lancer l&apos;analyse algorithmique d&apos;analyses.
                  </p>
                  <div className="jrn-actions" style={{ marginTop: 'var(--jrn-2)' }}>
                    <button onClick={handleSkip} disabled={savingTransition} className="jrn-btn jrn-btn--ghost">
                      Passer cette étape (cliente sans analyses)
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // État B : pré-q reçu mais anamnèse pas encore validée par Anissa
          if (!anamnesisValidated) {
            return (
              <div className="jrn-surface jrn-surface--quiet">
                <div className="jrn-empty">
                  <div className="jrn-empty__icon">📋</div>
                  <p className="jrn-empty__title">Pré-questionnaire reçu</p>
                  <p className="jrn-empty__hint">
                    Avant de proposer les analyses, retourne sur l&apos;étape <strong>Onboarding</strong> pour
                    relire les réponses, faire le RDV anamnèse et valider. L&apos;analyse algorithmique
                    s&apos;appuiera ensuite sur l&apos;anamnèse complète pour proposer les bons tests.
                  </p>
                  <div className="jrn-actions" style={{ marginTop: 'var(--jrn-2)' }}>
                    <button onClick={handleSkip} disabled={savingTransition} className="jrn-btn jrn-btn--ghost">
                      Passer cette étape
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // État C : anamnèse validée — on peut proposer les analyses (comportement original)
          return (
            <div className="jrn-surface jrn-surface--quiet">
              <div className="jrn-empty">
                <div className="jrn-empty__icon">🧪</div>
                <p className="jrn-empty__title">Aucun plan d&apos;analyses</p>
                <p className="jrn-empty__hint">
                  L&apos;algorithme va proposer des tests en croisant l&apos;anamnèse, le pack acheté et les axes prioritaires. Tu garderas la main pour valider, écarter ou ajouter.
                </p>
                <div className="jrn-actions" style={{ marginTop: 'var(--jrn-2)' }}>
                  <button onClick={() => setShowSuggest(true)} className="jrn-btn jrn-btn--primary">
                    ✨ Lancer l'analyse algorithmique
                  </button>
                  <button onClick={handleSkip} disabled={savingTransition} className="jrn-btn jrn-btn--ghost">
                    Passer cette étape
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
  // V97.13.3 : timeline reactive — fetch le plan pour connaitre l'etat reel
  // des prelevements (client_status par test). On reflete la realite
  // bidirectionnelle V97.13 dans le mini-stepper.
  const [planTests, setPlanTests] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('analysis_plans')
        .select('selected_tests')
        .eq('client_id', client.id)
        .in('status', ['sent', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.selected_tests) {
        setPlanTests(Array.isArray(data.selected_tests) ? data.selected_tests : []);
      }
    })();
    return () => { cancelled = true; };
  }, [client.id]);

  // Etat agrege : tous les tests ont-ils ete marques par la cliente ?
  const allTestsCollected = planTests.length > 0 && planTests.every(
    (t) => t.client_status === 'sent_by_client' || t.client_status === 'sample_taken'
  );

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
        intro="Les prélèvements sont au laboratoire. Le plan nutritionnel reste verrouillé jusqu'à réception des résultats."
      />

      {/* ─── Bloc 1 : Timeline d'envoi (V97.13.3 reactive) ────────── */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">1</span>
          <h3 className="jrn-block__title">Statut d'envoi</h3>
        </div>
        <p className="jrn-block__intro">
          Avancement réel des prélèvements et du circuit laboratoire.
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
            <li className={`jrn-timeline__item ${allTestsCollected ? 'jrn-timeline__item--done' : 'jrn-timeline__item--active'}`}>
              <span className="jrn-timeline__dot">{allTestsCollected ? '✓' : '⏳'}</span>
              <div>
                <div className="jrn-timeline__title">Prélèvement & laboratoire</div>
                <p className="jrn-timeline__hint">
                  {allTestsCollected
                    ? 'Tous les prélèvements ont été effectués par la cliente. Le labo traite et te transmettra les résultats sous 5–10 jours.'
                    : 'La cliente effectue les prélèvements (kit postal ou prise de sang). Les statuts remontent ci-dessous en temps réel.'}
                </p>
              </div>
            </li>
            <li className={`jrn-timeline__item ${allTestsCollected ? 'jrn-timeline__item--active' : ''}`}>
              <span className="jrn-timeline__dot">{allTestsCollected ? '⏳' : '•'}</span>
              <div>
                <div className="jrn-timeline__title">Réception des résultats</div>
                <p className="jrn-timeline__hint">
                  Le laboratoire envoie les résultats par email à toi et à la cliente en parallèle. Tu peux les saisir dès réception, sans attendre.
                </p>
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

      {/* ─── Bloc 3 : Action — Marquer reçus (V97.13.3 wording corrige) ─ */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">3</span>
          <h3 className="jrn-block__title">Réception</h3>
        </div>
        <p className="jrn-block__intro">
          Le laboratoire envoie les résultats à toi et à la cliente en parallèle (PDF par email). Tu peux saisir dès réception, sans attendre la cliente.
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

  // V97.4 V3.C — upsert d'un champ marker sur le test idx.
  // Structure cible : from_plan[idx].markers = [{ marker_code, label, unit, value, synthesis, status }]
  // - Si le marker n'existait pas encore : on l'ajoute en récupérant label/unit depuis le catalogue.
  // - Si déjà présent : on patch le champ demandé.
  // - Ne touche jamais value/synthesis/status au niveau test (legacy preservé).
  const updateTestMarker = (testIdx, markerCode, field, value) => {
    setResultsByTest((prev) => prev.map((r, i) => {
      if (i !== testIdx) return r;
      const existing = Array.isArray(r.markers) ? r.markers : [];
      const mIdx = existing.findIndex((m) => m && m.marker_code === markerCode);
      let nextMarkers;
      if (mIdx === -1) {
        const catalogMarkers = r.test_code ? getExpectedMarkersForTest(r.test_code) : [];
        const cat = catalogMarkers.find((cm) => cm && cm.code === markerCode);
        nextMarkers = [
          ...existing,
          {
            marker_code: markerCode,
            label: cat?.label || markerCode,
            unit: cat?.unit || null,
            value: '',
            synthesis: '',
            status: null,
            [field]: value,
          },
        ];
      } else {
        nextMarkers = existing.map((m, k) => k === mIdx ? { ...m, [field]: value } : m);
      }
      return { ...r, markers: nextMarkers };
    }));
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
  // Tonalité globale (V97.13.6 : nouveaux statuts cliniques V97.13.5 inclus).
  // Hierarchie de gravite : eleve > sous_optimal > prioritaire (legacy) >
  // surveiller > optimal > non_interpretable.
  const overallTone = statusCounts.eleve > 0
    ? 'eleve'
    : statusCounts.sous_optimal > 0
    ? 'sous_optimal'
    : statusCounts.prioritaire > 0
    ? 'prioritaire'
    : statusCounts.surveiller > 0
    ? 'surveiller'
    : statusCounts.optimal > 0
    ? 'optimal'
    : null;
  const overallLabel =
    overallTone === 'eleve' ? 'Profil avec marqueurs élevés' :
    overallTone === 'sous_optimal' ? 'Profil avec marqueurs sous-optimaux' :
    overallTone === 'prioritaire' ? 'Profil avec marqueurs prioritaires' :
    overallTone === 'surveiller' ? 'Profil à surveiller' :
    overallTone === 'optimal' ? 'Profil stable' :
    'Profil en cours d\'analyse';

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
            {resultsByTest.map((r, i) => {
              // V97.4 V3.C — marqueurs attendus depuis catalog (peut être []).
              // Si le test n'est pas dans le catalogue, expectedMarkers === [] et
              // ResultCard ne rend pas la section dynamique : mode résultat libre uniquement.
              const expectedMarkers = r.test_code ? getExpectedMarkersForTest(r.test_code) : [];
              return (
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
                  expectedMarkers={expectedMarkers}
                  markers={Array.isArray(r.markers) ? r.markers : []}
                  onMarkerChange={(markerCode, field, value) => updateTestMarker(i, markerCode, field, value)}
                />
              );
            })}
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
// V97.13.5 : statuts cliniques au lieu de medical brut (normal/eleve/bas).
// Wording valide user 2026-05-13 : ton clinique, non-diagnostique, defendable
// juridiquement pour une nutritionniste fonctionnelle. "Sous-optimal" cible
// les carences sans poser de diagnostic. "Non interpretable" pour les valeurs
// hors contexte (manque de range, unite ambigue, etc.).
const STATUSES = [
  { value: 'optimal',          label: 'Optimal',          icon: '🟢' },
  { value: 'surveiller',       label: 'À surveiller',     icon: '🟡' },
  { value: 'sous_optimal',     label: 'Sous-optimal',     icon: '🟠' },
  { value: 'eleve',            label: 'Élevé',            icon: '🔴' },
  { value: 'non_interpretable',label: 'Non interprétable',icon: '⚪' },
];

// V97.13.7 : templates par categorie pour aide cognitive a la saisie.
// Pas un formulaire rigide — juste une structure prefillable que Anissa
// peut completer librement. Objectif : construire un "langage clinique
// interne" coherent entre dossiers, sans perdre la flexibilite du textarea.
const VALUES_TEMPLATES = {
  microbiote: `Diversité (Shannon) :
Dysbiose (1-10) :
Perméabilité (zonuline) :
Inflammation (calprotectine, histamine) :
Flore protectrice (butyrate, Akkermansia) :
Levures / opportunistes :
sIgA :`,
  hormonal: `Cortisol / DHEA :
Thyroïde (TSH, T3l, T4l, anti-TPO) :
Hormones sexuelles :
Métabolites :`,
  sang: `Vitamines (D, B12, B9, folates) :
Minéraux (Mg, Zn, Fer, Ferritine, Sat. transferrine) :
Oligo-éléments (Sélénium, Cuivre) :
Acides gras (Index oméga-3) :`,
  inflammation: `CRP us :
Calprotectine :
Marqueurs Th1/Th2 :
Histamine :`,
  // Catégorie générique pour analyses non typées
  default: `Valeurs principales :
Marqueurs hors normes :
Observations labo :`,
};

const SYNTHESIS_TEMPLATE = `Axes principaux :

Priorité nutritionnelle :

Points de vigilance :`;

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

// V97.4 V3.C — exporté pour permettre les tests unitaires (vitest) +
// le mount dans la route dev /preview-v3c. Pas de consommation externe en prod.
export function ResultCard({
  title, badge, badgeColor,
  value, synthesis,
  category, status,
  onValueChange, onSynthesisChange,
  onCategoryChange, onStatusChange,
  editable, onTitleChange, onDelete,
  // V97.4 V3.C — props optionnelles. Si expectedMarkers absent/vide,
  // la carte se comporte exactement comme avant (résultat libre uniquement).
  expectedMarkers, markers, onMarkerChange,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <label className="jrn-result-card__section-label" style={{ marginBottom: 0 }}>Valeurs laboratoire</label>
          {/* V97.13.7 : bouton "Insérer modèle" — pre-remplit le textarea
              avec une mini-structure guidee selon la categorie du test.
              Visible uniquement si le textarea est vide pour ne pas ecraser
              une saisie en cours. */}
          {!value && (
            <button
              type="button"
              onClick={() => onValueChange(VALUES_TEMPLATES[category] || VALUES_TEMPLATES.default)}
              style={{
                fontSize: 11,
                color: 'var(--jrn-accent, #2d5a3d)',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontWeight: 500,
              }}
              title="Insérer une structure guidée pour la saisie"
            >
              + Insérer modèle
            </button>
          )}
        </div>
        <textarea
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          rows={2}
          className="jrn-result-card__values-textarea"
          placeholder="Ex&nbsp;: B12 = 1200 pg/mL (norme 200-900) · Vit D = 18 ng/mL · Ferritine = 22 ng/mL…"
        />
      </div>

      {/* V97.4 V3.C — Section Marqueurs attendus (conditionnelle).
          Apparaît uniquement si le test a des expectedMarkers dans le catalogue
          ET qu'un handler onMarkerChange est fourni. Sinon la carte reste en
          mode résultat libre comme avant. Aucun champ n'est obligatoire — Anissa
          peut tout laisser vide ("non renseigné"). */}
      {Array.isArray(expectedMarkers) && expectedMarkers.length > 0 && onMarkerChange && (
        <div className="jrn-result-card__markers">
          <label className="jrn-result-card__section-label">Marqueurs attendus</label>
          <div className="jrn-marker-grid">
            {expectedMarkers.map((em) => {
              const saved = Array.isArray(markers)
                ? markers.find((m) => m && m.marker_code === em.code)
                : null;
              const mValue = saved?.value || '';
              const mNote = saved?.synthesis || '';
              const mStatus = saved?.status || '';
              // P1.4 — avertissement DOUX de plausibilité (non bloquant).
              const plausibility = validateMarkerValue(em.code, mValue);
              return (
                <div key={em.code} className={`jrn-marker-row${mStatus ? ` jrn-marker-row--${mStatus}` : ''}`}>
                  <div className="jrn-marker-row__head">
                    <span className="jrn-marker-row__label">{em.label}</span>
                    {em.unit && <span className="jrn-marker-row__unit">{em.unit}</span>}
                  </div>
                  <input
                    type="text"
                    value={mValue}
                    onChange={(e) => onMarkerChange(em.code, 'value', e.target.value)}
                    placeholder="Valeur (non renseigné si vide)"
                    className="jrn-marker-row__value"
                    style={!plausibility.plausible ? { borderColor: '#b8860b' } : undefined}
                  />
                  {!plausibility.plausible && (
                    <div
                      className="jrn-marker-row__warning"
                      style={{ gridColumn: '1 / -1', fontSize: 11, color: '#8a6508', marginTop: 2 }}
                    >
                      {plausibility.message}
                    </div>
                  )}
                  <input
                    type="text"
                    value={mNote}
                    onChange={(e) => onMarkerChange(em.code, 'synthesis', e.target.value)}
                    placeholder="Note Anissa (optionnel)"
                    className="jrn-marker-row__note"
                  />
                  <select
                    value={mStatus}
                    onChange={(e) => onMarkerChange(em.code, 'status', e.target.value || null)}
                    className="jrn-marker-row__status"
                    title="Statut clinique du marqueur"
                  >
                    <option value="">Statut…</option>
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2 : Lecture clinique Anissa (éditorial, plus lisible) */}
      <div className="jrn-result-card__interpretation">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <label className="jrn-result-card__section-label jrn-result-card__section-label--accent" style={{ marginBottom: 0 }}>Lecture clinique</label>
          {/* V97.13.7 : bouton "Insérer modèle synthese" */}
          {!synthesis && (
            <button
              type="button"
              onClick={() => onSynthesisChange(SYNTHESIS_TEMPLATE)}
              style={{
                fontSize: 11,
                color: 'var(--jrn-accent, #2d5a3d)',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontWeight: 500,
              }}
              title="Insérer une structure axes / priorité / vigilance"
            >
              + Insérer modèle
            </button>
          )}
        </div>
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

  // Autosave debounced 250ms — persiste la directive sur la dernière consultation.
  // V97.13.x : debounce réduit (1500→250) pour éviter race condition avec ouverture
  // du modal Génération qui re-fetch DB. Anissa colle + clique Générer dans la foulée.
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
    }, 250);
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
            <JourneyPlanEditor
              client={client}
              onPlanSaved={handlePlanSaved}
              controlledAiDirectives={aiDirectives}
            />
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

function StepDelivery({ client, onChange, onOpenAppPreview }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [versionsCount, setVersionsCount] = useState(0);
  const [includePaper, setIncludePaper] = useState(true);
  const [paperExported, setPaperExported] = useState(false);
  const [lastConsultDate, setLastConsultDate] = useState(null);
  // V97.13.12 : modification de la date de remise (migré du menu Plus dashboard)
  const [showEditDate, setShowEditDate] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  const prenom = (client?.form?.prenom || client?.prenom || 'la cliente').trim();
  const pack = PACK_DEFINITIONS[client.packType] || null;
  const packLabel = pack?.label || 'Accompagnement';

  // Charge le nombre de versions + date dernière consultation
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { getNutritionConsultations } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        if (cancelled) return;
        setVersionsCount(list.length);
        if (list[0]?.createdAt) setLastConsultDate(list[0].createdAt);
        // V97.13.23 — restaure paperExported depuis la persistance pour
        // que le jalon 'Livret papier exporté' reste 'done' après un refresh.
        // paperGenerated est set true par handleMarkShipped.
        if (list[0]?.paperGenerated) setPaperExported(true);
        // Par défaut : papier ON pour V1, OFF pour adaptations
        if (list.length > 1) setIncludePaper(false);
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [client?.id]);

  const isFirstVersion = versionsCount <= 1;

  // Détection automatique du nombre d'analyses retenues (best-effort)
  const analysesCount = useMemo(() => {
    const plan = client?.analysisPlan || client?.analysis_plan;
    const tests = plan?.selectedTests || plan?.selected_tests;
    if (Array.isArray(tests) && tests.length > 0) return tests.length;
    return null;
  }, [client?.analysisPlan, client?.analysis_plan]);

  const validationDateLabel = lastConsultDate
    ? new Date(lastConsultDate).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  // Pesée — toggle local (lecture seule pour le miroir)
  const weightTrackingEnabled = !!(client?.weightTrackingEnabled ?? client?.weight_tracking_enabled);

  // V97.13.22 — workflow hybride physique + digital (3 états)
  const journey = client?.journey_state || {};
  const isShipped = !!journey.protocol_shipped;
  const isReceived = !!journey.client_received_confirmed;
  const shippedAt = journey.protocol_shipped_at;
  const receivedAt = journey.protocol_received_at;
  const shippedDateLabel = shippedAt
    ? new Date(shippedAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long' })
    : null;
  const receivedDateLabel = receivedAt
    ? new Date(receivedAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long' })
    : null;
  const daysSinceShipped = shippedAt
    ? Math.floor((Date.now() - new Date(shippedAt).getTime()) / 86400000)
    : null;

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

  const handleExportWord = async () => {
    setExporting(true);
    setErr(null);
    try {
      const [{ exportPlanToWord }, { getNutritionConsultations }, { ExportClinicalError, formatClearanceForConfirm }] = await Promise.all([
        import('./services/exportToWord'),
        import('./store'),
        import('./services/clinicalClearance'),
      ]);
      const consultations = getNutritionConsultations(client.id) || [];
      const last = consultations[0];
      if (!last) throw new Error('Aucune consultation à exporter');
      // P1.2 — le gate vit dans exportPlanToWord (service). Override conscient.
      try {
        await exportPlanToWord(client, last, last.nutritionPlan || '');
      } catch (ce) {
        if (ce instanceof ExportClinicalError) {
          if (!window.confirm(formatClearanceForConfirm(ce.verdict))) {
            setExporting(false);
            return;
          }
          // V97.28 — override confirmé : on trace (fire-and-forget, non bloquant).
          const { traceClinicalOverride, CLINICAL_OVERRIDE_DOORS } = await import('./services/clinicalOverrideAudit');
          void traceClinicalOverride(ce.verdict, CLINICAL_OVERRIDE_DOORS.EXPORT_WORD, {
            clientId: client?.id,
            consultationId: last?.id,
          });
          await exportPlanToWord(client, last, last.nutritionPlan || '', { clinicalOverride: true });
        } else {
          throw ce;
        }
      }
      setPaperExported(true);
    } catch (e) {
      setErr(e?.message || 'Erreur export Word');
    } finally {
      setExporting(false);
    }
  };

  // V97.13.22 — étape 1 : Anissa marque le protocole comme expédié
  const handleMarkShipped = async () => {
    setBusy(true); setErr(null);
    try {
      if (includePaper) {
        const { getNutritionConsultations, saveNutritionConsultation } = await import('./store');
        const list = getNutritionConsultations(client.id) || [];
        const last = list[0];
        if (last) {
          await saveNutritionConsultation({ ...last, paperGenerated: true });
        }
      }
      await transitions.markProtocolShipped(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur'); }
    finally { setBusy(false); }
  };

  // V97.13.22 — étape 2 : confirmation manuelle exceptionnelle (normalement
  // c'est la cliente qui clique 'J'ai reçu' dans l'app cliente).
  const handleConfirmReceivedManually = async () => {
    if (!window.confirm(
      `Confirmer manuellement la réception du protocole par ${prenom} ?\n\n` +
      `Normalement, ${prenom} clique sur "J'ai reçu mon protocole" depuis son app cliente. ` +
      `N'utilise cette action que si elle ne peut pas le faire (oubli, problème app, etc.).`
    )) return;
    setBusy(true); setErr(null);
    try {
      await transitions.confirmProtocolReceived(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur'); }
    finally { setBusy(false); }
  };

  // V97.13.22 — étape 3 : Anissa active l'espace cliente (= ancien markDelivered).
  // Le journey passe à 'followup', l'app cliente débloque le protocole complet,
  // la timeline du pack démarre.
  // V97.13.22/25/26 — étape 3 : Anissa active l'espace cliente.
  // V97.13.25 : 1 clic = publication du plan + activation espace.
  // V97.13.26 : fix casing — getNutritionConsultations retourne nutritionPlan
  // (camelCase) mais publishConsultationToClientApp lit nutrition_plan (snake_case).
  const handleDelivered = async () => {
    setBusy(true); setErr(null);
    try {
      // 1. Récupère la dernière consultation à publier
      const { getNutritionConsultations } = await import('./store');
      const consultations = getNutritionConsultations(client.id) || [];
      const lastConsult = consultations[0];

      // 2. Publie le plan vers l'app cliente AVANT de basculer journey à followup.
      if (lastConsult) {
        const {
          publishConsultationToClientApp,
          markPublishedLocally,
          checkClientReadyForPublish,
          PublishClinicalError,
        } = await import('./services/publishToClientApp');

        // V97.13.26 — normalise les 2 conventions de nommage pour que
        // publishConsultationToClientApp accepte les consultations issues
        // du store (nutritionPlan camelCase) comme celles fetched depuis
        // Supabase directement (nutrition_plan snake_case).
        const consultForPublish = {
          ...lastConsult,
          nutrition_plan: lastConsult.nutrition_plan || lastConsult.nutritionPlan || '',
        };

        const ready = checkClientReadyForPublish(client, consultForPublish);
        if (!ready.ok) {
          throw new Error(`Impossible de publier : ${ready.issues.join(' · ')}`);
        }

        // P1.2 — clairance clinique (fail-closed côté service). Override conscient
        // si une violation HIGH bloque la publication.
        try {
          await publishConsultationToClientApp(client, consultForPublish);
        } catch (pubErr) {
          if (pubErr instanceof PublishClinicalError) {
            const { formatClearanceForConfirm } = await import('./services/clinicalClearance');
            if (!window.confirm(formatClearanceForConfirm(pubErr.verdict))) {
              return;
            }
            // V97.28 — override confirmé : on trace (fire-and-forget, non bloquant).
            const { traceClinicalOverride, CLINICAL_OVERRIDE_DOORS } = await import('./services/clinicalOverrideAudit');
            void traceClinicalOverride(pubErr.verdict, CLINICAL_OVERRIDE_DOORS.PUBLISH_APP, {
              clientId: client?.id,
              consultationId: consultForPublish?.id,
            });
            await publishConsultationToClientApp(client, consultForPublish, null, { clinicalOverride: true });
          } else {
            throw pubErr;
          }
        }
        markPublishedLocally(client.id);
      }

      // 3. Bascule journey à followup + flag delivered + packStartedAt
      await transitions.markDelivered(client.id);
      onChange();
    } catch (e) {
      setErr(e?.message || 'Erreur lors de l\'activation');
    } finally { setBusy(false); }
  };

  // V97.13.22 — Timeline de déploiement alignée sur workflow hybride (3 états).
  // Les jalons reflètent maintenant : validation → expédition physique →
  // attente cliente → confirmation réception → activation espace cliente.
  const deploymentSteps = [
    {
      key: 'plan-validated',
      label: 'Protocole validé',
      hint: `Version V${versionsCount || 1} sauvegardée dans l'atelier`,
      status: 'done',
    },
    {
      key: 'paper-export',
      label: includePaper ? 'Livret papier exporté' : 'Livret papier — désactivé pour ce cycle',
      hint: includePaper
        ? ((paperExported || isShipped)
            ? 'Word téléchargé. Reste à imprimer + préparer le pli.'
            : 'À télécharger en Word ci-dessous, puis imprimer.')
        : `${prenom} recevra son protocole uniquement via l'app pour ce cycle.`,
      // V97.13.23 — paperExported lu depuis persistance au mount,
      // ET si le protocole est déjà expédié, on considère forcément le
      // papier comme fait (markShipped a setté paperGenerated=true).
      status: includePaper ? ((paperExported || isShipped) ? 'done' : 'pending') : 'skipped',
    },
    {
      key: 'shipped',
      label: 'Protocole expédié à la cliente',
      hint: isShipped
        ? `Marqué expédié${shippedDateLabel ? ` le ${shippedDateLabel}` : ''}.`
        : `Quand le courrier est prêt à partir, marque-le comme expédié ci-dessous.`,
      status: isShipped ? 'done' : 'pending',
    },
    {
      key: 'received',
      label: `Réception confirmée par ${prenom}`,
      hint: isReceived
        ? `Cliente a confirmé la réception${receivedDateLabel ? ` le ${receivedDateLabel}` : ''}.`
        : isShipped
          ? `En attente — ${prenom} confirmera depuis son app cliente.`
          : `Étape automatique une fois le protocole expédié.`,
      status: isReceived ? 'done' : (isShipped ? 'pending' : 'pending'),
    },
    {
      key: 'space-active',
      label: 'Espace cliente activé',
      hint: 'Plan complet, fiche frigo, suppléments, ressentis, messagerie — débloqués après ta validation.',
      status: 'pending',
    },
  ];

  // V97.13.13 — Miroir cliente repense : 1 carte FEATURED (app cliente,
  // coeur du suivi long terme) + 2-3 cartes secondaires plus discretes.
  // App centrale, livret en extension premium (pas l'inverse).
  const featuredAppCard = {
    icon: '📱',
    title: 'Application Anissa Nutrition',
    subtitle: `${prenom} accède à son espace privé sécurisé, disponible mobile & desktop.`,
    contents: [
      { label: 'Protocole personnalisé', desc: `Version V${versionsCount || 1} consultable et lisible chaque jour` },
      { label: 'Fiche frigo plastifiable', desc: 'Matrice repas + suppléments toujours sous la main' },
      { label: 'Suppléments structurés', desc: 'Routine répartie sur 5 moments de la journée' },
      { label: 'Ressentis quotidiens', desc: weightTrackingEnabled ? 'Énergie, digestion, sommeil + poids' : 'Énergie, digestion, sommeil' },
      { label: 'Messagerie directe', desc: 'Réponses Anissa sous 24h en jours ouvrables' },
      { label: 'Adaptations évolutives', desc: `Les versions suivantes du protocole arrivent dans l'app sans rupture` },
    ],
  };

  const secondaryMirrorItems = [];
  if (includePaper) {
    secondaryMirrorItems.push({
      icon: '📦',
      label: 'Livret papier premium',
      sub: `Envoi postal — ancre l'expérience à la maison de ${prenom}.`,
    });
  }
  secondaryMirrorItems.push({
    icon: '📋',
    label: 'Protocole complet (PDF natif)',
    sub: `Version archivable, partageable avec médecin si besoin.`,
  });

  return (
    <section className="jrn-activation-step">
      <StepHead
        index={7}
        title="Activation cliente"
        intro={`Le protocole de ${prenom} est prêt. Cette étape orchestre sa remise — un moment important du parcours.`}
      />

      {/* ════════ HERO — Protocole prêt pour activation ════════ */}
      <div className="jrn-activation-hero">
        <div className="jrn-activation-hero__top">
          <span className="jrn-activation-hero__badge">
            <span className="jrn-activation-hero__badge-dot" aria-hidden>✓</span>
            Protocole prêt pour activation
          </span>
        </div>
        <h2 className="jrn-activation-hero__title">
          Le protocole personnalisé de <em>{prenom}</em> est prêt.
        </h2>
        <p className="jrn-activation-hero__lede">
          Toutes les validations cliniques ont été réalisées.
          <span className="jrn-activation-hero__lede-break" /> Le suivi peut maintenant commencer.
        </p>
        <dl className="jrn-activation-hero__meta">
          <div className="jrn-activation-hero__meta-cell">
            <dt>Praticienne</dt>
            <dd>Anissa Deroubaix</dd>
          </div>
          <div className="jrn-activation-hero__meta-cell">
            <dt>Pack</dt>
            <dd>{packLabel}</dd>
          </div>
          <div className="jrn-activation-hero__meta-cell">
            <dt>Version protocole</dt>
            <dd>V{versionsCount || 1}</dd>
          </div>
          {analysesCount !== null && (
            <div className="jrn-activation-hero__meta-cell">
              <dt>Analyses retenues</dt>
              <dd>{analysesCount}</dd>
            </div>
          )}
          {validationDateLabel && (
            <div className="jrn-activation-hero__meta-cell">
              <dt>Validé le</dt>
              <dd>{validationDateLabel}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* ════════ Bloc 1 — Options de remise ════════
          V97.13.36 : ordre logique repense (Options → Miroir → Deploiement).
          Configurer AVANT de visualiser : Anissa decide d abord ce qu elle
          inclut (papier oui/non, suivi poids), puis le miroir REFLETE ces
          options, puis la timeline execute. Avant : Options arrivait apres
          le miroir, ce qui demandait a Anissa de re-visualiser. */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">1</span>
          <h3 className="jrn-block__title">Options de remise</h3>
        </div>
        <p className="jrn-block__intro">
          Deux réglages avant l'activation. Tu peux les ajuster sans toucher au protocole lui-même.
        </p>

        {/* Toggle livret papier */}
        <div className="jrn-paper-card">
          <div className="jrn-paper-card__head">
            <PremiumSwitch checked={includePaper} onChange={setIncludePaper} />
            <button
              type="button"
              className="jrn-paper-card__head-text"
              onClick={() => setIncludePaper(!includePaper)}
            >
              <div className="jrn-paper-card__title">
                <span aria-hidden>📦</span> Livret papier postal
              </div>
              <div className="jrn-paper-card__hint">
                {isFirstVersion
                  ? `Recommandé pour ce premier cycle — ancre l'expérience chez ${prenom}.`
                  : `À activer uniquement pour les changements majeurs (nouvelle phase, refonte protocole).`}
              </div>
            </button>
          </div>
          {includePaper && (
            <div className="jrn-paper-card__steps">
              <div className="jrn-paper-card__steps-label">Marche à suivre</div>
              <ol className="jrn-paper-card__steps-list">
                <li>Exporter le document Word ci-dessous</li>
                <li>Imprimer (recto-verso conseillé)</li>
                <li>Préparer enveloppe + étiquette à l'adresse de {prenom}</li>
                <li>Expédier postalement</li>
              </ol>
              <button
                onClick={handleExportWord}
                disabled={exporting}
                className="jrn-btn jrn-btn--soft jrn-paper-card__btn"
              >
                {exporting ? 'Export en cours…' : (paperExported ? '✓ Word téléchargé — Re-télécharger' : '📥 Exporter le Word')}
              </button>
            </div>
          )}
        </div>

        {/* Toggle suivi poids — option fine */}
        <div className="jrn-inline-card jrn-inline-card--accent">
          <div className="jrn-inline-card__row">
            <div className="jrn-inline-card__body">
              <div className="jrn-inline-card__title">
                <span aria-hidden>⚖️</span> Suivi du poids
              </div>
              <div className="jrn-inline-card__hint">
                Activer si le poids est un axe du protocole. {prenom} saisira sa pesée dans le ressenti quotidien.
              </div>
            </div>
            <WeightTogglesInline client={client} compact />
          </div>
        </div>
      </div>

      {/* ════════ Bloc 2 — Miroir cliente (app cliente centrale) ════════ */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">2</span>
          <h3 className="jrn-block__title">Ce que reçoit {prenom}</h3>
        </div>
        <p className="jrn-block__intro">
          L'application est le cœur du suivi long terme. Le reste vient s'y greffer comme extensions premium.
        </p>

        {/* Carte FEATURED — App cliente, centre de l'expérience.
            V97.13.14 : mockup téléphone à gauche pour incarner visuellement
            l'app comme cœur émotionnel du parcours (vs simple carte texte). */}
        <article className="jrn-mirror-featured jrn-mirror-featured--with-phone">
          <div className="jrn-mirror-featured__phone" aria-hidden="true">
            <div className="jrn-phone-mockup">
              <div className="jrn-phone-mockup__screen">
                {/* iOS-like status bar */}
                <div className="jrn-phone-mockup__statusbar">
                  <span>9:24</span>
                  <span className="jrn-phone-mockup__statusbar-right">
                    <span className="jrn-phone-mockup__bar jrn-phone-mockup__bar--s" />
                    <span className="jrn-phone-mockup__bar jrn-phone-mockup__bar--m" />
                    <span className="jrn-phone-mockup__bar jrn-phone-mockup__bar--l" />
                    <span className="jrn-phone-mockup__battery" />
                  </span>
                </div>

                {/* Header — avatar Anissa + greeting */}
                <div className="jrn-phone-mockup__header">
                  <div className="jrn-phone-mockup__avatar">A</div>
                  <div className="jrn-phone-mockup__header-text">
                    <div className="jrn-phone-mockup__hi">Bonjour {prenom}</div>
                    <div className="jrn-phone-mockup__sub">Jour 1 · semaine 1</div>
                  </div>
                </div>

                {/* Mini courbe ressentis 7j */}
                <div className="jrn-phone-mockup__chart">
                  <div className="jrn-phone-mockup__chart-head">
                    <span className="jrn-phone-mockup__chart-label">Énergie · 7 jours</span>
                    {/* P3.1 — aucun chiffre clinique inventé, même en décoration :
                        le mockup est un exemple, pas un vrai résultat cliente. */}
                    <span className="jrn-phone-mockup__chart-trend">exemple</span>
                  </div>
                  <svg className="jrn-phone-mockup__chart-svg" viewBox="0 0 200 44" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="jrnPhoneArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1A2E1F" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#1A2E1F" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M5,36 Q35,32 60,26 T120,16 T195,7 L195,44 L5,44 Z" fill="url(#jrnPhoneArea)" />
                    <path d="M5,36 Q35,32 60,26 T120,16 T195,7" stroke="#1A2E1F" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="5" cy="36" r="2.2" fill="#1A2E1F" />
                    <circle cx="42" cy="30" r="2.2" fill="#1A2E1F" />
                    <circle cx="80" cy="22" r="2.2" fill="#1A2E1F" />
                    <circle cx="118" cy="16" r="2.2" fill="#1A2E1F" />
                    <circle cx="156" cy="11" r="2.2" fill="#1A2E1F" />
                    <circle cx="195" cy="7" r="3" fill="#fff" stroke="#1A2E1F" strokeWidth="2" />
                  </svg>
                </div>

                {/* Card repas */}
                <div className="jrn-phone-mockup__card">
                  <span className="jrn-phone-mockup__card-icon">🥑</span>
                  <div className="jrn-phone-mockup__card-body">
                    <div className="jrn-phone-mockup__card-label">Petit-déjeuner</div>
                    <div className="jrn-phone-mockup__card-text">Œufs · avocat · pain complet</div>
                  </div>
                  <span className="jrn-phone-mockup__check">✓</span>
                </div>

                {/* Message Anissa */}
                <div className="jrn-phone-mockup__msg">
                  <div className="jrn-phone-mockup__msg-avatar">A</div>
                  <div className="jrn-phone-mockup__msg-bubble">
                    Comment se passe ta semaine ?
                  </div>
                </div>

                {/* Tab bar */}
                <div className="jrn-phone-mockup__tabbar">
                  <span className="jrn-phone-mockup__tab jrn-phone-mockup__tab--active" />
                  <span className="jrn-phone-mockup__tab" />
                  <span className="jrn-phone-mockup__tab" />
                  <span className="jrn-phone-mockup__tab" />
                </div>
              </div>
            </div>
          </div>
          <div className="jrn-mirror-featured__body">
            <header className="jrn-mirror-featured__head jrn-mirror-featured__head--no-icon">
              <div className="jrn-mirror-featured__head-text">
                <div className="jrn-mirror-featured__eyebrow">Espace cliente — cœur du suivi</div>
                <h4 className="jrn-mirror-featured__title">{featuredAppCard.title}</h4>
                <p className="jrn-mirror-featured__subtitle">{featuredAppCard.subtitle}</p>
              </div>
            </header>
            <ul className="jrn-mirror-featured__contents">
              {featuredAppCard.contents.map((c, i) => (
                <li key={i} className="jrn-mirror-featured__content">
                  <span className="jrn-mirror-featured__content-check" aria-hidden>✓</span>
                  <div>
                    <div className="jrn-mirror-featured__content-label">{c.label}</div>
                    <div className="jrn-mirror-featured__content-desc">{c.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </article>

        {/* Cartes secondaires : extensions premium */}
        {secondaryMirrorItems.length > 0 && (
          <>
            <div className="jrn-mirror-secondary-label">Extensions premium</div>
            <ul className="jrn-mirror-secondary">
              {secondaryMirrorItems.map((item, i) => (
                <li key={i} className="jrn-mirror-item">
                  <span className="jrn-mirror-icon" aria-hidden>{item.icon}</span>
                  <div className="jrn-mirror-text">
                    <div className="jrn-mirror-label">{item.label}</div>
                    <div className="jrn-mirror-sub">{item.sub}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* V97.13.30 — Bouton unique 'Vérifier l'espace cliente' qui ouvre la
            modal complète. L'enrichissement IA est dispo depuis l'intérieur de
            la modal (bouton en haut). Plus de redondance. */}
        <div className="jrn-mirror-actions">
          <button
            type="button"
            onClick={() => onOpenAppPreview?.()}
            className="jrn-btn jrn-btn--soft"
            title="Voir exactement ce que Camille va recevoir dans son app + enrichir avec IA si besoin avant publication"
          >
            👁 Vérifier l'espace cliente
          </button>
        </div>
      </div>

      {/* ════════ Bloc 3 — Déploiement de l'accompagnement ════════
          V97.13.36 : remonte ici (etait Bloc 1) pour que la timeline arrive
          APRES la config et le miroir. Ordre narratif : configure → visualise
          → execute. */}
      <div className="jrn-block">
        <div className="jrn-block__head">
          <span className="jrn-block__num">3</span>
          <h3 className="jrn-block__title">Déploiement de l'accompagnement</h3>
        </div>
        <p className="jrn-block__intro">
          Cinq jalons s'enchaînent. Le premier est validé. La confirmation finale ci-dessous déclenche les suivants.
        </p>
        <ol className="jrn-deploy-list">
          {deploymentSteps.map((step, i) => (
            <li key={step.key} className={`jrn-deploy-item jrn-deploy-item--${step.status}`}>
              <span className="jrn-deploy-marker" aria-hidden>
                {step.status === 'done' ? '✓' : step.status === 'skipped' ? '—' : i + 1}
              </span>
              <div className="jrn-deploy-body">
                <div className="jrn-deploy-label">{step.label}</div>
                <div className="jrn-deploy-hint">{step.hint}</div>
              </div>
              {step.status === 'pending' && (
                <span className="jrn-deploy-status">À l'activation</span>
              )}
              {step.status === 'done' && (
                <span className="jrn-deploy-status jrn-deploy-status--done">Terminé</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* ════════ Bloc 4 — Date d'activation (si déjà activé) ════════ */}
      {client.packStartedAt && (
        <div className="jrn-block">
          <div className="jrn-block__head">
            <span className="jrn-block__num">4</span>
            <h3 className="jrn-block__title">Date d'activation</h3>
          </div>
          <p className="jrn-block__intro">
            Référence pour la timeline du suivi (étape 8). Modifiable si erreur de saisie.
          </p>
          <div className="jrn-activation-date">
            <div className="jrn-activation-date__value">
              {new Date(client.packStartedAt).toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            {!showEditDate && (
              <button
                onClick={() => {
                  setNewDeliveryDate(new Date(client.packStartedAt).toISOString().slice(0, 10));
                  setShowEditDate(true);
                }}
                className="jrn-btn jrn-btn--ghost"
                title="Corriger la date si erreur — la timeline du suivi démarre depuis cette date"
              >
                📅 Modifier
              </button>
            )}
            {showEditDate && (
              <div className="jrn-activation-date__edit">
                <input
                  type="date"
                  value={newDeliveryDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
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

      {/* ════════ CTA — V97.13.22 machine à 3 états (workflow hybride) ════════
          État 1 : protocole prêt → bouton "Marquer comme expédié"
          État 2 : expédié, attente cliente → statut + bouton secondaire manuel
          État 3 : reçu (cliente confirmée) → bouton "Activer l'espace cliente"
          Workflow premium physique + digital. */}

      {/* État 1 — Protocole prêt à expédier */}
      {!isShipped && (
        <div className="jrn-activation-cta jrn-activation-cta--ship">
          <div className="jrn-activation-cta__copy">
            <div className="jrn-activation-cta__eyebrow">Étape physique</div>
            <p className="jrn-activation-cta__poetic">
              Le protocole de <em>{prenom}</em> est prêt à être expédié.
            </p>
            <p className="jrn-activation-cta__sub">
              {includePaper
                ? `Imprime le Word ci-dessus, prépare le courrier et clique ici quand le pli est posté.`
                : `Marque ici quand le protocole est prêt à être remis à ${prenom}.`}
            </p>
          </div>
          <button
            onClick={handleMarkShipped}
            disabled={busy}
            className="jrn-btn jrn-btn--hero jrn-activation-cta__btn"
          >
            {busy ? 'Enregistrement…' : `📦 Marquer le protocole comme expédié`}
          </button>
        </div>
      )}

      {/* État 2 — Expédié, en attente de confirmation cliente */}
      {isShipped && !isReceived && (
        <div className="jrn-activation-cta jrn-activation-cta--waiting">
          <div className="jrn-activation-cta__copy">
            <div className="jrn-activation-cta__eyebrow">
              <span className="jrn-activation-cta__status-dot" aria-hidden /> En cours d'acheminement
            </div>
            <p className="jrn-activation-cta__poetic">
              Protocole expédié{shippedDateLabel ? ` le ${shippedDateLabel}` : ''}.
            </p>
            <p className="jrn-activation-cta__sub">
              {prenom} confirmera la réception depuis son app cliente
              {daysSinceShipped !== null && daysSinceShipped > 0
                ? ` (envoyé il y a ${daysSinceShipped}j).`
                : '.'}
              {' '}L'espace d'accompagnement complet sera ensuite déblocable.
            </p>
          </div>
          <button
            onClick={handleConfirmReceivedManually}
            disabled={busy}
            className="jrn-btn jrn-btn--soft jrn-activation-cta__btn"
            title="À utiliser uniquement si la cliente ne peut pas confirmer depuis l'app"
          >
            {busy ? '…' : `Confirmer réception manuellement`}
          </button>
        </div>
      )}

      {/* État 3 — Reçu, espace cliente à activer */}
      {isShipped && isReceived && (
        <div className="jrn-activation-cta jrn-activation-cta--ready">
          <div className="jrn-activation-cta__copy">
            <div className="jrn-activation-cta__eyebrow">
              <span className="jrn-activation-cta__status-check" aria-hidden>✓</span> Réception confirmée
            </div>
            <p className="jrn-activation-cta__poetic">
              <em>{prenom}</em> a reçu son protocole
              {receivedDateLabel ? ` le ${receivedDateLabel}` : ''}.
            </p>
            <p className="jrn-activation-cta__sub">
              L'accompagnement complet peut maintenant démarrer : plan, ressentis, messagerie, suivi.
            </p>
          </div>
          <button
            onClick={handleDelivered}
            disabled={busy}
            className="jrn-btn jrn-btn--hero jrn-activation-cta__btn"
          >
            {busy ? 'Activation…' : `✨ Activer l'espace de ${prenom} →`}
          </button>
        </div>
      )}

      <ErrorLine msg={err} />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ÉTAPE 8 — SUIVI
// ═══════════════════════════════════════════════════════════════════

// V97.41 (roadmap 1.4) — styles du badge de synchro app cliente (page Suivi).
const syncBadgeRowStyle = {
  marginTop: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
};
const syncBadgeMutedStyle = {
  color: 'var(--jrn-text-muted, #6b6f6b)',
  letterSpacing: '.01em',
};
const syncBadgeErrorStyle = {
  color: '#e08a8a',
  letterSpacing: '.01em',
};
const syncRetryBtnStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 6,
  color: 'var(--jrn-text-muted, #8a8f8a)',
  fontSize: 10.5,
  fontFamily: 'inherit',
  padding: '2px 8px',
  cursor: 'pointer',
};

function StepFollowup({ client, journey, onChange, onExit, onReturnPlan, onSendPackReview, onViewHistory, onOpenAppPreview }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loadingFb, setLoadingFb] = useState(true);
  const [adapting, setAdapting] = useState(false);
  // V97.41 (roadmap 1.4) — badge de synchro app cliente + retry.
  // lastSyncAt = horodatage du dernier fetch reussi des ressentis/pesees.
  // syncError = true si le dernier fetch a echoue (reseau/proxy/app cliente).
  // syncReloadKey = bump pour re-declencher l'effet de fetch (bouton Reessayer).
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncError, setSyncError] = useState(false);
  const [syncReloadKey, setSyncReloadKey] = useState(0);
  const handleRetrySync = useCallback(() => setSyncReloadKey((k) => k + 1), []);
  const [versions, setVersions] = useState([]);
  const [previewVersion, setPreviewVersion] = useState(null);
  // V97.28 — Modal éditeur inline pour cycle de suivi. Anissa peut éditer
  // la V courante (ou créer une suite) sans repasser par l'étape 6 du parcours.
  // current_step reste sur 'followup'.
  const [showInlineEditor, setShowInlineEditor] = useState(false);
  const started = !!journey?.followup_started;

  // V97.13.16 — variables d'identité partagées avec étape 7
  const prenom = (client?.form?.prenom || client?.prenom || 'la cliente').trim();

  // V97.17.1 — Consultation active (pour protocol_phases dans le cockpit timeline)
  // Pattern identique a handleAdaptFromFeedback ligne 3865.
  const [activeConsult, setActiveConsult] = useState(() =>
    client?.id ? ((getNutritionConsultations(client.id) || [])[0] || null) : null
  );
  // Recharge si client change (changement de cliente)
  useEffect(() => {
    if (!client?.id) {
      setActiveConsult(null);
      return;
    }
    setActiveConsult((getNutritionConsultations(client.id) || [])[0] || null);
  }, [client?.id]);

  // V97.39.8 (roadmap 1.1) — phases acceptees mais en attente d'une
  // consultation hote (journey_state.pending_protocol_phases).
  const pendingPhases = journey?.pending_protocol_phases || null;

  // Handler save phases — passe par store + reflete local optimiste
  const handleSavePhases = useCallback(
    async (newProtocolPhases) => {
      // V97.39.8 (roadmap 1.1) — Cas "sans consultation hote" (pack Bilan :
      // page Suivi atteinte sans plan, cf. melissa). Anissa accepte le parcours
      // alors qu'aucune consultation n'existe pour le porter. On NE cree PAS de
      // consultation (ca consommerait le compteur de pack) : on range les
      // phases dans journey_state.pending_protocol_phases. Elles seront
      // greffees sur la 1ere consultation creee (effet de greffe ci-dessous).
      // Pas de push : il n'y a pas encore de transition de phase cote cliente.
      if (!activeConsult) {
        if (!client?.id) return;
        await setPendingProtocolPhases(client.id, newProtocolPhases);
        onChange?.();
        return;
      }
      const newActivePhaseId =
        newProtocolPhases?.phases?.find((p) => p.status === 'active')?.id || null;
      const prevActivePhaseId = activeConsult.active_phase_id || null;
      // V97.17.16 — Detection d'une vraie transition de phase (pas init ni reset).
      // Si prev et new sont differents ET les deux non-null → push notif cliente.
      const isTransition =
        prevActivePhaseId &&
        newActivePhaseId &&
        prevActivePhaseId !== newActivePhaseId;

      const next = {
        ...activeConsult,
        protocol_phases: newProtocolPhases,
        active_phase_id: newActivePhaseId,
      };
      await saveNutritionConsultation(next);
      setActiveConsult(next);

      // V97.17.16 — Push notif a la cliente a chaque transition de phase.
      // Best-effort : si la cliente n'a pas active les push, ignore silencieusement.
      if (isTransition) {
        const newPhase = newProtocolPhases?.phases?.find(
          (p) => p.id === newActivePhaseId
        );
        const identity = clientIdentityFields(client);
        if (newPhase && (identity.email || identity.client_id)) {
          try {
            const { clientAppFetch } = await import('./services/clientAppFetch');
            await clientAppFetch('/api/admin/push/send', {
              method: 'POST',
              payload: {
                ...identity,
                title: 'Votre parcours évolue',
                body: `Vous êtes maintenant en Phase ${newPhase.order} : ${newPhase.client_name}.`,
                url: '/plan#strategie',
                tag: `phase-transition-${newPhase.id}`,
              },
            });
          } catch (pushErr) {
            // eslint-disable-next-line no-console
            console.warn(
              '[phase-transition-push] failed (non-bloquant):',
              pushErr?.message || pushErr
            );
          }
        }
      }
    },
    [activeConsult, client, onChange]
  );

  // V97.39.8 (roadmap 1.1) — Greffe des phases en attente sur la 1ere
  // consultation qui apparait. CENTRALISE le transfert : peu importe le
  // chemin de creation de la consultation (editeur de plan, "Creer la suite",
  // import…), des qu'une consultation existe et qu'il y a des phases en
  // attente, on les greffe via bakePendingProtocolPhases + on nettoie le
  // champ pending. Pas de push : c'est une INITIALISATION du parcours, pas une
  // transition de phase (aucune phase precedente cote cliente).
  useEffect(() => {
    if (!activeConsult || activeConsult.protocol_phases) return;
    if (!pendingPhases || !client?.id) return;
    let cancelled = false;
    (async () => {
      const { consultation: next, baked } = bakePendingProtocolPhases(activeConsult, pendingPhases);
      if (!baked) return;
      await saveNutritionConsultation(next);
      if (cancelled) return;
      setActiveConsult(next);
      try {
        await clearPendingProtocolPhases(client.id);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[pending-phases] clear failed (non-bloquant):', e?.message || e);
      }
      onChange?.();
    })();
    return () => { cancelled = true; };
  }, [activeConsult, pendingPhases, client, onChange]);

  // Phase AJ : log des consultations effectuees
  const pack = PACK_DEFINITIONS[client.packType] || null;
  const packLabel = pack?.label || 'Accompagnement';
  const consultationsTotal = pack?.consultations || 0;
  const consultationsLog = Array.isArray(journey?.consultations_log) ? journey.consultations_log : [];
  const consultationsUsed = consultationsLog.length;
  const daysSincePack = client.packStartedAt && client.packStartedAtConfirmed === true
    ? Math.max(1, Math.floor((Date.now() - new Date(client.packStartedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const activeVersion = versions[0] || null;
  const lastConsultDate = consultationsLog.length > 0
    ? consultationsLog[consultationsLog.length - 1]?.date
    : null;

  // Phase AK : extraction des pesees depuis les feedbacks deja charges.
  // Une pesee = un feedback avec weight_kg non null (cf. migration weight_tracking).
  //
  // V97.39.8 (roadmap 1.5) — Mutualisation du double-fetch. Avant : 2 appels
  // reseau au chargement (90 j pour le poids + 14 j pour les ressentis). Ce
  // seul effet fait UN appel 90 j, derive le poids (90 j) ET les ressentis
  // (fenetre 14 j filtree localement). Comportement identique, moitie moins de
  // requetes.
  const [weightEntries, setWeightEntries] = useState([]);
  const [loadingWeight, setLoadingWeight] = useState(true);
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    setLoadingWeight(true);
    setLoadingFb(true);
    setSyncError(false);
    (async () => {
      try {
        const { fetchClientFeedbacks } = await import('./services/fetchClientFeedbacks');
        const list = await fetchClientFeedbacks(client, 90);
        if (cancelled) return;
        // fetchClientFeedbacks renvoie { ok, error } : un ok:false (reseau /
        // proxy / app cliente) doit lever le badge "echec", pas passer pour
        // une synchro vide reussie.
        if (list && typeof list === 'object' && list.ok === false) {
          throw new Error(list.error || 'Synchro app cliente echouee');
        }
        const fbs = Array.isArray(list) ? list : (list?.feedbacks || []);

        // Pesees : fenetre 90 j, weight_kg numerique, tri decroissant.
        const entries = fbs
          .filter((f) => typeof f.weight_kg === 'number')
          .map((f) => ({ date: f.date || f.created_at, weight_kg: Number(f.weight_kg) }))
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        setWeightEntries(entries);

        // Ressentis : meme source, fenetre 14 j (preserve la semantique
        // d'avant pour adherence / tendances / alertes cliniques).
        const cutoff14 = Date.now() - 14 * 86400000;
        const recent = fbs.filter((f) => {
          const ts = new Date(f.date || f.created_at).getTime();
          return Number.isFinite(ts) && ts >= cutoff14;
        });
        setFeedbacks(recent);
        setLastSyncAt(new Date());
        setSyncError(false);
      } catch {
        if (!cancelled) {
          setWeightEntries([]);
          setFeedbacks([]);
          setSyncError(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingWeight(false);
          setLoadingFb(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [client?.id, syncReloadKey]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  const handleLogConsultation = async (payload = {}) => {
    // V97.17.6 — payload structure : { note?: string, clinical?: object|null }
    // Backward compat : si appele sans argument, fallback sur logNote local.
    const finalNote = typeof payload.note === 'string' ? payload.note : logNote;
    const finalClinical = payload.clinical || null;
    setSavingLog(true);
    setErr(null);
    try {
      await transitions.logConsultation(client.id, { notes: finalNote, clinical: finalClinical });
      setLogNote('');
      setShowLogModal(false);
      onChange();

      // V97.17.6.1 — chaine de la decision clinique vers le workflow versioning.
      // Apres save de la consultation, si la decision implique une action
      // (adapter / nouvelle version / transition phase), on enchaine direct
      // pour fermer la boucle clinique.
      const dec = finalClinical?.decision;
      if (dec === 'adapt' || dec === 'newVersion') {
        // Confirm + trigger creation V suivante. handleAdaptFromFeedback a deja
        // son propre confirm contextuel (V97.17.5).
        setTimeout(() => {
          handleAdaptFromFeedback();
        }, 250);
      } else if (dec === 'transition') {
        // Transition vers phase suivante : on demande confirmation et on applique.
        setTimeout(async () => {
          const phases = activeConsult?.protocol_phases;
          const active = getActivePhase(phases);
          if (!phases || !active) {
            window.alert('Aucune phase active pour cette cliente. Configurez d\'abord le parcours thérapeutique.');
            return;
          }
          const phaseList = phases.phases || [];
          const nextPhase = phaseList[phaseList.findIndex((p) => p.id === active.id) + 1];
          if (!nextPhase) {
            window.alert(`${prenom} est déjà sur la dernière phase du parcours (${active.client_name}).`);
            return;
          }
          const ok = window.confirm(
            `Transition de phase ?\n\n` +
            `${prenom} passe de :\n  Phase ${active.order} · ${active.client_name}\nà :\n  Phase ${nextPhase.order} · ${nextPhase.client_name}\n\n` +
            `Cette decision a ete prise lors de la consultation que tu viens d'enregistrer.`
          );
          if (!ok) return;
          try {
            const updated = transitionToNextPhase(phases);
            await handleSavePhases(updated);

            // V97.23 (V97.18 Phase E) — Auto-generation brouillon IA pour la
            // nouvelle phase active. Fire-and-forget, ne bloque pas l'UI.
            // Anissa verra le brouillon dans Phase F (cockpit drafts) une
            // fois Claude termine (~30-60s). Si echec, log warn silencieux.
            autoGeneratePlanForPhaseTransition({
              client,
              fromPhaseId: active.id,
              toPhaseId: nextPhase.id,
              templateKey: updated.template,
              weekNumber: 1,
              sourceConsultationId: activeConsult?.id,
            }).then((res) => {
              if (res.ok) {
                // eslint-disable-next-line no-console
                console.log(`[auto-gen-phase] brouillon ${res.draftId} pret a valider (client ${client?.id})`);
              } else {
                // eslint-disable-next-line no-console
                console.warn(`[auto-gen-phase] echec (client ${client?.id}):`, res.error);
              }
            });
          } catch (e) {
            window.alert('Erreur transition : ' + (e?.message || 'inconnue'));
          }
        }, 250);
      }
      // dec === 'continue' → ne rien faire (V actuelle inchangee)
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

  // Ressentis 14 j : derives de l'effet 90 j unifie ci-dessus (plus de double fetch).

  const handleStart = async () => {
    setBusy(true); setErr(null);
    try {
      await transitions.startFollowup(client.id);
      onChange();
    } catch (e) { setErr(e?.message || 'Erreur'); }
    finally { setBusy(false); }
  };

  // V97.28 — Ouverture modal inline (ne change PLUS current_step).
  // Avant : restartPlanEditing rebasculait l'étape sur 'plan_editing' et
  // forçait Anissa à re-traverser tout le parcours pour revalider.
  // Maintenant : la modale ouvre l'éditeur direct sur la V courante,
  // current_step reste 'followup'. Anissa édite, sauvegarde une nouvelle
  // version, ferme la modale, et continue le suivi.
  const handleRestartEditing = () => {
    setShowInlineEditor(true);
  };

  // Refresh versions après save dans la modal inline
  const handleInlineEditorPlanSaved = async () => {
    try {
      const { getNutritionConsultations } = await import('./store');
      const list = getNutritionConsultations(client.id) || [];
      setVersions(list);
      setActiveConsult(list[0] || null);
    } catch { /* silencieux */ }
  };

  const handleAdaptFromFeedback = async () => {
    if (feedbacks.length === 0) {
      setErr('Aucun ressenti à exploiter pour créer la suite du protocole.');
      return;
    }
    {
      const nextVersionNum = (versions?.length || 0) + 1;
      const previousVersion = versions?.length || 0;
      const msg = `Créer la suite du protocole — V${nextVersionNum} ?\n\nL'IA va proposer la prochaine version du protocole de ${prenom} en tenant compte des derniers ressentis. La V${previousVersion || 1} actuelle sera conservée dans l'historique. Vous serez ensuite redirigée vers l'éditeur pour relire et publier la V${nextVersionNum}.\n\nLe parcours thérapeutique se poursuit — ce n'est pas un nouveau plan, c'est l'évolution de celui en cours.`;
      if (!window.confirm(msg)) return;
    }
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

  // V97.13.18 — calculs cockpit (clinical signals + next action priority)
  const lastFeedback = feedbacks[0] || null;
  const daysSinceLastFeedback = lastFeedback?.created_at
    ? Math.floor((Date.now() - new Date(lastFeedback.created_at).getTime()) / 86400000)
    : null;
  const adherencePct = Math.min(100, Math.round((feedbacks.length / 14) * 100));
  const lastVersion = versions[0] || null;
  const daysSinceLastVersion = lastVersion?.createdAt
    ? Math.floor((Date.now() - new Date(lastVersion.createdAt).getTime()) / 86400000)
    : null;
  const lastConsultDays = lastConsultDate
    ? Math.floor((Date.now() - new Date(lastConsultDate).getTime()) / 86400000)
    : null;
  const lastWeight = weightEntries[0] || null;
  const oldestWeight = weightEntries[weightEntries.length - 1] || null;
  const weightDelta = lastWeight && oldestWeight && weightEntries.length > 1
    ? Number((lastWeight.weight_kg - oldestWeight.weight_kg).toFixed(1))
    : null;

  // V97.13.21 — moteur d'attention clinique multi-priorités.
  // Ordre = priorité décroissante. Premier match gagne.
  // tone: 'go' = action data-prête / 'warn' = signal manquant / 'ok' = RAS.
  let nextAction = { label: `Suivi en cours — rien d'urgent`, tone: 'ok' };
  if (started) {
    // V97.13.24 — cliente fraîchement activée (premier jour du pack, rien à signaler)
    if (daysSincePack !== null && daysSincePack < 3 && feedbacks.length === 0 && consultationsUsed === 0) {
      nextAction = { label: `Suivi tout juste lancé — attendre les premiers ressentis`, tone: 'ok' };
    }
    // P1 — adaptation IA en attente de validation (V2+, exclut le plan initial V1)
    else if (lastVersion && lastVersion.status === 'a_valider' && versions.length >= 2) {
      nextAction = { label: `Version V${versions.length} du protocole prête à valider`, tone: 'go' };
    }
    // P2 — poids décroche (delta absolu > 3kg sur ≥ 3 pesées)
    else if (weightDelta !== null && Math.abs(weightDelta) >= 3 && weightEntries.length >= 3) {
      const dir = weightDelta > 0 ? '+' : '';
      nextAction = { label: `Poids ${dir}${weightDelta}kg sur ${weightEntries.length} pesées — analyser`, tone: 'warn' };
    }
    // P3 — première consultation pas planifiée après J+7 pack
    else if (consultationsTotal > 0 && consultationsUsed === 0 && daysSincePack !== null && daysSincePack >= 7) {
      nextAction = { label: `Première consultation à planifier (jour ${daysSincePack})`, tone: 'warn' };
    }
    // P4 — silence ressentis ≥ 7j (cliente active qui décroche)
    else if (daysSinceLastFeedback !== null && daysSinceLastFeedback >= 7) {
      nextAction = { label: `Silence ressentis depuis ${daysSinceLastFeedback}j — relancer`, tone: 'warn' };
    }
    // P5 — aucun ressenti reçu après J+3 d'activation
    else if (feedbacks.length === 0 && daysSincePack !== null && daysSincePack >= 3) {
      nextAction = { label: `Pas de ressenti reçu — relancer ${prenom}`, tone: 'warn' };
    }
    // P6 — première suite du protocole possible (data accumulée)
    else if (feedbacks.length >= 5 && versions.length <= 1) {
      nextAction = { label: 'Suite du protocole possible — V2 à créer', tone: 'go' };
    }
    // P7 — nouvelle suite à envisager (cycle long depuis dernière)
    else if (versions.length >= 2 && daysSinceLastVersion !== null && daysSinceLastVersion >= 14) {
      nextAction = { label: `Suite du protocole à envisager — V${versions.length + 1} (${daysSinceLastVersion}j depuis V${versions.length})`, tone: 'go' };
    }
  }

  // V97.13.21 — signaux temporels pour le hero (Axe 4 démarrage)
  const heroSignals = [];
  if (started) {
    // Dernier ressenti
    if (feedbacks.length === 0) {
      heroSignals.push({ key: 'feedback', label: 'Ressenti', value: 'jamais reçu', tone: 'warn' });
    } else if (daysSinceLastFeedback === 0) {
      heroSignals.push({ key: 'feedback', label: 'Ressenti', value: 'aujourd\'hui', tone: 'ok' });
    } else if (daysSinceLastFeedback !== null && daysSinceLastFeedback < 24 * 60) {
      heroSignals.push({
        key: 'feedback', label: 'Ressenti',
        value: daysSinceLastFeedback === 1 ? 'hier' : `il y a ${daysSinceLastFeedback}j`,
        tone: daysSinceLastFeedback >= 5 ? 'warn' : 'ok'
      });
    }
    // Dernière activité = consultation la plus récente sinon livraison
    if (lastConsultDays !== null && lastConsultDays !== undefined) {
      heroSignals.push({
        key: 'activity', label: 'Activité',
        value: lastConsultDays === 0 ? 'consult. aujourd\'hui' : `consult. il y a ${lastConsultDays}j`,
        tone: 'ok'
      });
    } else if (daysSincePack !== null) {
      heroSignals.push({
        key: 'activity', label: 'Activité',
        value: daysSincePack === 0 ? 'livraison aujourd\'hui' : `livraison il y a ${daysSincePack}j`,
        tone: daysSincePack >= 14 ? 'warn' : 'ok'
      });
    }
    // Prochaine consultation
    if (consultationsTotal > 0 && consultationsUsed === 0) {
      heroSignals.push({ key: 'next', label: 'Prochaine consult.', value: 'non planifiée', tone: 'warn' });
    } else if (consultationsTotal > 0 && consultationsUsed < consultationsTotal) {
      heroSignals.push({
        key: 'next', label: 'Consultations',
        value: `${consultationsUsed} / ${consultationsTotal}`,
        tone: 'ok'
      });
    }
  }

  return (
    <section className="jrn-followup-step jrn-cockpit">
      {/* ════════ HERO COCKPIT — V97.13.21 (signaux temporels axe 4) ════════ */}
      <header className="jrn-cockpit-hero">
        <div className="jrn-cockpit-hero__id">
          <h2 className="jrn-cockpit-hero__title">
            Suivi · {prenom}
          </h2>
          <p className="jrn-cockpit-hero__sub">
            {packLabel}
            {daysSincePack ? ` · jour ${daysSincePack}` : ''}
            {started ? ` · cycle actif` : ' · à démarrer'}
            {started && lastVersion ? ` · protocole V${versions.length} active` : ''}
          </p>
          {/* V97.41 (roadmap 1.4) — badge synchro app cliente + retry.
              Donne a Anissa la confiance que les ressentis/pesees affiches sont
              a jour (ou signale une synchro echouee avec moyen de relancer). */}
          <div style={syncBadgeRowStyle}>
            {(loadingFb || loadingWeight) ? (
              <span style={syncBadgeMutedStyle}>Synchro app cliente…</span>
            ) : syncError ? (
              <>
                <span style={syncBadgeErrorStyle}>⚠ Synchro app cliente échouée</span>
                <button type="button" onClick={handleRetrySync} style={syncRetryBtnStyle}>
                  Réessayer
                </button>
              </>
            ) : (
              <>
                <span style={syncBadgeMutedStyle}>
                  Synchronisé
                  {lastSyncAt
                    ? ` à ${lastSyncAt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </span>
                <button
                  type="button"
                  onClick={handleRetrySync}
                  style={syncRetryBtnStyle}
                  title="Rafraîchir les ressentis & pesées depuis l'app cliente"
                >
                  ↻ Rafraîchir
                </button>
              </>
            )}
          </div>
          {started && (
            <p
              style={{
                marginTop: 4,
                fontSize: 11,
                color: 'var(--jrn-text-muted, #6b6f6b)',
                fontStyle: 'italic',
                letterSpacing: '.01em',
              }}
              title="Le protocole n'est pas figé : chaque consultation peut générer une nouvelle version (V2, V3...) en conservant l'historique complet. C'est un dossier thérapeutique vivant."
            >
              Dossier thérapeutique vivant — chaque consultation peut faire évoluer le protocole vers une V suivante.
            </p>
          )}
          {started && heroSignals.length > 0 && (
            <ul className="jrn-cockpit-hero__signals">
              {heroSignals.map(s => (
                <li
                  key={s.key}
                  className={`jrn-cockpit-hero__signal jrn-cockpit-hero__signal--${s.tone}`}
                >
                  <span className="jrn-cockpit-hero__signal-label">{s.label}</span>
                  <span className="jrn-cockpit-hero__signal-value">{s.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {started && (
          <div className="jrn-cockpit-hero__actions">
            <button
              onClick={() => setShowLogModal(true)}
              disabled={consultationsTotal > 0 && consultationsUsed >= consultationsTotal}
              className="jrn-btn jrn-btn--soft"
              title={consultationsTotal > 0 && consultationsUsed >= consultationsTotal ? 'Quota du pack atteint' : 'Logger une consultation — point de pivot pour la prochaine version du protocole'}
            >
              + Consultation
            </button>
            <button
              onClick={handleAdaptFromFeedback}
              disabled={adapting || feedbacks.length === 0}
              className="jrn-btn jrn-btn--primary"
              title={feedbacks.length === 0 ? 'Aucun ressenti à exploiter pour générer la V suivante' : `L'IA propose la V${(versions?.length || 0) + 1} du protocole à partir des derniers ressentis cliente. La version actuelle est conservée dans l'historique.`}
            >
              {adapting ? 'Création V…' : `Créer la suite du protocole${versions?.length ? ` — V${versions.length + 1}` : ''}`}
            </button>
          </div>
        )}
      </header>

      {!started && (
        <div className="jrn-cockpit-empty">
          <p className="jrn-cockpit-empty__title">Cockpit de suivi non activé.</p>
          <p className="jrn-cockpit-empty__hint">
            Active le cockpit pour commencer à logger consultations, ressentis et adaptations.
            Le parcours initial est complet (livraison validée étape 7).
          </p>
          <button
            onClick={handleStart}
            disabled={busy}
            className="jrn-btn jrn-btn--primary"
          >
            {busy ? 'Activation…' : 'Activer le suivi'}
          </button>
        </div>
      )}

      {started && (
        <>
          {/* V97.17.1 — Cockpit Timeline en tete : frise temporelle (Vous etes ici)
              + parcours therapeutique 5 phases. Repond aux 3 questions du manifeste :
              ou j'en suis, qu'est-ce qui se passe, qu'est-ce qui vient ensuite.
              V97.17.5.2 : wrap dans ErrorBoundary pour eviter qu'un crash du
              cockpit casse toute la page Suivi (page noire signalee). */}
          <CockpitErrorBoundary>
            <SuiviCockpitTimeline
              client={client}
              consultation={activeConsult}
              packLabel={packLabel}
              daysSincePack={daysSincePack}
              consultationsUsed={consultationsUsed}
              consultationsTotal={consultationsTotal}
              consultationsLog={consultationsLog}
              feedbacks={feedbacks}
              versions={versions}
              weightEntries={weightEntries}
              onSavePhases={handleSavePhases}
              onOpenAppPreview={onOpenAppPreview}
              pendingPhases={pendingPhases}
            />
          </CockpitErrorBoundary>

          {/* BC.5 Étape 8 : refonte en blocs numérotés (alignement étapes 1-7)
              V97.13.16 : ajout bloc miroir cliente avec mockup phone (continuité étape 7) */}

          {/* V97.13.18 : refonte cockpit 2 colonnes (memory saas_cockpit_clinique_directive).
              Plus de cérémonial Playfair + mockup phone redondant avec étape 7.
              Anissa pilote au lieu de regarder. */}

          {/* ─── Prochaine action prioritaire ────────────────────────── */}
          <div className={`jrn-cockpit-card jrn-cockpit-card--priority jrn-cockpit-card--tone-${nextAction.tone}`}>
            <div className="jrn-cockpit-card__head">
              <span className="jrn-cockpit-card__eyebrow">Action prioritaire</span>
              <span className={`jrn-cockpit-card__tone jrn-cockpit-card__tone--${nextAction.tone}`}>
                {nextAction.tone === 'warn' ? '⚠' : nextAction.tone === 'go' ? '→' : '✓'}
              </span>
            </div>
            <p className="jrn-cockpit-card__priority-label">{nextAction.label}</p>
            {nextAction.tone === 'go' && feedbacks.length > 0 && (
              <button
                onClick={handleAdaptFromFeedback}
                disabled={adapting}
                className="jrn-btn jrn-btn--primary jrn-cockpit-card__priority-btn"
              >
                {adapting ? 'Création V…' : `Créer la V${(versions?.length || 0) + 1} du protocole →`}
              </button>
            )}
            {nextAction.tone === 'warn' && consultationsUsed === 0 && (
              <button
                onClick={() => setShowLogModal(true)}
                disabled={consultationsTotal > 0 && consultationsUsed >= consultationsTotal}
                className="jrn-btn jrn-btn--soft jrn-cockpit-card__priority-btn"
              >
                + Planifier consultation
              </button>
            )}
          </div>

          {/* ─── Grid 2 colonnes ─────────────────────────────────────── */}
          <div className="jrn-cockpit-grid">
            <div className="jrn-cockpit-col jrn-cockpit-col--main">

          {/* V97.17.20 — Detection de patterns preoccupants dans les ressentis
              cliente (digestion degradee, fatigue persistante, etc.). Banner
              contextuel au-dessus du Pouls clinique. */}
          <ClinicalAlertBanner feedbacks={feedbacks} syncError={syncError} />

          {/* V97.17.21 — Mini sparklines des ressentis sur 30 jours.
              Complete les patterns avec une vision graphique des tendances. */}
          <FeedbacksTrendChart feedbacks={feedbacks} syncError={syncError} />

          {/* V97.17.12 — Pouls clinique : agregation chips 3 dernieres consults.
              S'affiche au-dessus de Consultations si au moins 1 consult avec
              clinical existe. Permet a Anissa de voir l'evolution en 1 coup
              d'oeil sans relire chaque consultation. */}
          <ClientPulseSummary consultationsLog={consultationsLog} />

          {/* ─── Bloc 2 : Consultations ─────────────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">2</span>
              <h3 className="jrn-block__title">
                Consultations {consultationsTotal > 0 ? `· ${consultationsUsed}/${consultationsTotal}` : `· ${consultationsUsed}`}
              </h3>
              <div className="jrn-block__head-meta">
                <button
                  onClick={() => setShowLogModal(true)}
                  disabled={consultationsTotal > 0 && consultationsUsed >= consultationsTotal}
                  className="jrn-btn jrn-btn--soft"
                  title={consultationsTotal > 0 && consultationsUsed >= consultationsTotal ? 'Quota du pack atteint' : 'Logger une consultation — chaque consultation peut donner naissance à une V suivante du protocole'}
                >
                  ✅ Consultation effectuée
                </button>
              </div>
            </div>
            <p className="jrn-block__intro">
              Chaque RDV cabinet ou visio doit être enregistré ici. Le compteur alimente la timeline du pack et limite à la quantité incluse.
            </p>

            {consultationsLog.length === 0 && (
              <p className="jrn-cockpit-empty-row">
                Aucune consultation — à logger après chaque RDV.
              </p>
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
                        {/* V97.17.8 — Chips cliniques (symptomes/adherence/verdict/decision)
                            saisis via la modal LogConsultationModal V97.17.6. */}
                        <ConsultationClinicalSummary clinical={c.clinical} />
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

          {/* ─── Bloc 3 : Suivi du poids ─────────────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">3</span>
              <h3 className="jrn-block__title">Suivi du poids{weightEntries.length > 0 ? ` · ${weightEntries.length} pesée${weightEntries.length > 1 ? 's' : ''}` : ''}</h3>
            </div>
            <WeightTrackingSection
              client={client}
              entries={weightEntries}
              loading={loadingWeight}
              syncError={syncError}
            />
          </div>

          {/* ─── Bloc 4 : Derniers ressentis ─────────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">4</span>
              <h3 className="jrn-block__title">Derniers ressentis · {feedbacks.length}</h3>
              <div className="jrn-block__head-meta">
                <span className="jrn-meta-chip jrn-meta-chip--neutral">14 derniers jours</span>
              </div>
            </div>
            <p className="jrn-block__intro">
              Les ressentis quotidiens de la cliente nourrissent l'adaptation IA du plan (bloc 4 ci-dessous).
            </p>
            {/* P2.1 — état réel propagé : on ne dit « vient de démarrer » que si
                la synchro a réussi et qu'il n'y a réellement rien. Sous panne,
                on affiche un état distinct au lieu d'une assertion fausse. */}
            {signalDisplayState({ loading: loadingFb, syncError, count: feedbacks.length }) === 'loading' && (
              <p className="jrn-cockpit-empty-row">Chargement…</p>
            )}
            {signalDisplayState({ loading: loadingFb, syncError, count: feedbacks.length }) === 'sync_error' && (
              <p className="jrn-cockpit-empty-row">
                Ressentis indisponibles — synchro app cliente échouée. Donnée non récupérée (≠ absence de ressenti).
              </p>
            )}
            {signalDisplayState({ loading: loadingFb, syncError, count: feedbacks.length }) === 'empty' && (
              <p className="jrn-cockpit-empty-row">
                Aucun ressenti reçu sur 14 jours — cliente vient de démarrer.
              </p>
            )}
            {signalDisplayState({ loading: loadingFb, syncError, count: feedbacks.length }) === 'data' && (
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

            </div>
            <div className="jrn-cockpit-col jrn-cockpit-col--side">

          {/* ─── Bloc 5 : Cycle de suivi — actions ─────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">5</span>
              <h3 className="jrn-block__title">Cycle de suivi — actions</h3>
            </div>
            <p className="jrn-block__intro">
              Cycle : <strong>Créer la suite</strong> (bouton hero) → <strong>Relire</strong> (étape 6) → <strong>Publier la nouvelle version</strong> (étape 7) → retour ici. Plan de reprise = relance après pause.
            </p>
            <div className="jrn-actions" style={{ marginTop: 0 }}>
              {/* V97.13.20 : bouton 'Adapter le plan' retiré ici — déjà présent dans
                  le hero du cockpit. Plus de redondance d'action. */}
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

          {/* ─── Bloc 6 : Bilan pack 4 semaines ─────────────────── */}
          <div className="jrn-block">
            <div className="jrn-block__head">
              <span className="jrn-block__num">6</span>
              <h3 className="jrn-block__title">Bilan de cycle</h3>
            </div>
            <PackReviewSection client={client} onSendPackReview={onSendPackReview} />
          </div>

          {/* ─── Bloc 7 : Historique des versions ─────────────── */}
          {versions.length > 0 && (
            <div className="jrn-block">
              <div className="jrn-block__head">
                <span className="jrn-block__num">7</span>
                <h3 className="jrn-block__title">Historique des versions · {versions.length}</h3>
              </div>
              <p className="jrn-block__intro">
                Chaque suite du protocole crée une nouvelle version. La cliente voit toujours la version active, son protocole évolue avec elle.
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

            </div>
          </div>

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

      {/* Modale suivi clinique structure (V97.17.6 + V97.17.23 contexte ressentis) */}
      {showLogModal && (
        <LogConsultationModal
          consultationNumber={consultationsUsed + 1}
          totalIncluded={consultationsTotal}
          onCancel={() => { setShowLogModal(false); setLogNote(''); }}
          onConfirm={handleLogConsultation}
          saving={savingLog}
          recentFeedbacks={feedbacks?.slice(0, 7) || []}
        />
      )}

      {/* V97.28 — Modal éditeur inline (Cycle de suivi → Éditer manuellement).
          Ne change pas current_step. Permet d'éditer la V courante ou de créer
          une nouvelle version directement depuis l'étape Suivi. */}
      {showInlineEditor && (
        <InlineEditorModal
          client={client}
          onClose={() => setShowInlineEditor(false)}
          onPlanSaved={handleInlineEditorPlanSaved}
        />
      )}
    </section>
  );
}

// V97.28 — Modal plein écran qui héberge JourneyPlanEditor sans changer
// current_step. Sépare l'édition technique du protocole de la timeline parcours.
function InlineEditorModal({ client, onClose, onPlanSaved }) {
  const prenom = (client?.form?.prenom || client?.prenom || 'la cliente').trim();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Édition manuelle du protocole — ${prenom}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 24, 22, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        padding: '4vh 4vw',
      }}
    >
      <div style={{
        background: 'var(--jrn-bg, #FAF9F6)',
        borderRadius: 12,
        boxShadow: '0 24px 60px rgba(0,0,0,.25)',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--jrn-border, #EFEDE5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'white',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--jrn-text-soft, #6b6f6b)' }}>
              Cycle de suivi · Édition manuelle
            </p>
            <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--jrn-ink, #1A2E1F)' }}>
              Protocole — {prenom}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="jrn-btn jrn-btn--ghost"
            title="Fermer (l'étape de suivi reste active)"
          >
            ✕ Fermer
          </button>
        </div>
        {/* Body : JourneyPlanEditor scrollable */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <JourneyPlanEditor
            client={client}
            onPlanSaved={onPlanSaved}
          />
        </div>
        {/* Footer info */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--jrn-border, #EFEDE5)',
          background: 'rgba(46, 78, 56, 0.04)',
          fontSize: 11.5,
          color: 'var(--jrn-text-soft, #6b6f6b)',
        }}>
          Chaque sauvegarde crée une nouvelle version dans l'historique. L'étape de suivi reste active — vous restez dans le cycle, vous ne repassez pas par le parcours initial.
        </div>
      </div>
    </div>
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

  // V97.13.37 : action atomique pour activer/desactiver les 2 settings ensemble
  // (cas typique etape 7 Activation cliente : un seul toggle = simplicite UX).
  const toggleBothWeight = async () => {
    setUpdating('both');
    setCfgError(null);
    try {
      const { updateClientAppConfig } = await import('./services/clientAppConfig');
      const bothOn = !!config?.weight_tracking_enabled && !!config?.weight_visible_to_client;
      const updates = bothOn
        ? { weight_tracking_enabled: false, weight_visible_to_client: false }
        : { weight_tracking_enabled: true, weight_visible_to_client: true };
      const next = await updateClientAppConfig(client, updates);
      setConfig(next);
    } catch (e) {
      setCfgError(e?.message || 'Erreur mise à jour');
    } finally {
      setUpdating(null);
    }
  };

  return { config, loadingCfg, updating, cfgError, toggleConfig, toggleBothWeight };
}

function WeightTogglesInline({ client, compact = false }) {
  const { config, loadingCfg, updating, cfgError, toggleConfig, toggleBothWeight } = useClientWeightConfig(client);
  if (loadingCfg) return null;
  const trackingEnabled = !!config?.weight_tracking_enabled;
  const visibleToClient = !!config?.weight_visible_to_client;

  // V97.13.37 : mode compact (etape 7 Activation cliente) = 1 SEUL toggle qui
  // active les 2 settings ensemble (tracking + visible cliente). Cas typique :
  // Anissa veut activer le suivi du poids ET autoriser Camille a saisir. Si
  // elle a besoin du cas avance (tracking sans saisie cliente), elle passe par
  // le drawer ⚙ Configurer de l'etape 8 (mode non-compact ci-dessous).
  if (compact) {
    const bothOn = trackingEnabled && visibleToClient;
    return (
      <>
        <ToggleChip
          label="Suivi du poids"
          checked={bothOn}
          onClick={toggleBothWeight}
          loading={updating === 'both'}
          title="Active le suivi du poids et autorise Camille a saisir sa pesee dans l'app"
        />
        {cfgError && <div className="jrn-error" style={{ marginTop: 6 }}>⚠ {cfgError}</div>}
      </>
    );
  }

  // Mode complet (drawer ⚙ Configurer étape 8) : 2 toggles granulaires pour
  // les cas avancés (suivi privé coach sans saisie cliente, etc.).
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleChip
          label="Suivi activé"
          checked={trackingEnabled}
          onClick={() => toggleConfig('weight_tracking_enabled')}
          loading={updating === 'tracking'}
          title="Active le suivi du poids pour cette cliente"
        />
        {trackingEnabled && (
          <ToggleChip
            label="Camille saisit dans l'app"
            checked={visibleToClient}
            onClick={() => toggleConfig('weight_visible_to_client')}
            loading={updating === 'visible'}
            title="Affiche le champ poids dans l'app cliente (sinon Anissa saisit en consultation)"
          />
        )}
      </div>
      {cfgError && <div className="jrn-error" style={{ marginTop: 6 }}>⚠ {cfgError}</div>}
    </>
  );
}

function WeightTrackingSection({ client, entries, loading, syncError }) {
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

  // V97.13.20 — densité progressive : si 0 pesée + tracking désactivé,
  // le bloc se replie en 1 ligne avec lien 'Configurer'.
  const isFullyEmpty = !loading && !loadingCfg && entries.length === 0 && !trackingEnabled;
  const [showConfig, setShowConfig] = useState(false);

  if (isFullyEmpty && !showConfig) {
    return (
      <p className="jrn-cockpit-empty-row">
        Aucune pesée — suivi du poids inactif ·{' '}
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className="jrn-cockpit-empty-row__link"
        >
          Configurer
        </button>
      </p>
    );
  }

  return (
    <div style={{ marginBottom: 'var(--jrn-6)' }}>
      {/* V97.13.21 : toggles config sortis du flux clinique principal.
          Bouton '⚙ Configurer' discret en haut à droite, drawer inline si cliqué.
          V97.17.2 : badge etat ACTIVE/INACTIF clair (feedback Anissa : on ne
          voyait pas l'etat sur la card).
          V97.17.6.3 : titre interne 'Suivi du poids' supprime — le titre
          externe de la card (h3.jrn-block__title) le contient deja. Plus de
          doublon visuel. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--jrn-3)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!loadingCfg && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 999,
              background: trackingEnabled
                ? 'rgba(26, 46, 31, 0.08)'
                : 'rgba(120, 120, 120, 0.08)',
              color: trackingEnabled ? '#1A2E1F' : '#8a8a8a',
              border: trackingEnabled
                ? '1px solid rgba(26, 46, 31, 0.25)'
                : '1px solid rgba(120, 120, 120, 0.20)',
            }}>
              {trackingEnabled
                ? (visibleToClient ? '✓ Activé · cliente saisit' : '✓ Activé · mode coach')
                : '○ Désactivé'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="jrn-cockpit-config-btn"
          title="Configurer le suivi du poids"
        >
          ⚙ Configurer
        </button>
      </div>

      {showConfig && (
        <div className="jrn-cockpit-config-drawer">
          <WeightTogglesInline client={client} />
        </div>
      )}

      {(loading || loadingCfg) && (
        <p className="jrn-cockpit-empty-row">Chargement…</p>
      )}

      {/* P2.1 — sous panne synchro, on n'affirme pas « en attente des pesées »
          (on ne sait pas) : état distinct de l'absence réelle. */}
      {!loading && !loadingCfg && syncError && trackingEnabled && (
        <div className="jrn-surface" style={{ padding: 'var(--jrn-5)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#785a1a', fontStyle: 'italic' }}>
            Pesées indisponibles — synchro app cliente échouée. Donnée non récupérée (≠ absence de pesée).
          </p>
        </div>
      )}

      {/* V97.17.2 — placeholder graphique si activé sans data (au lieu d'une
          ligne de texte sobre). Permet a Anissa de visualiser l'absence de
          courbe en plus du badge etat ci-dessus. */}
      {!loading && !loadingCfg && !syncError && entries.length === 0 && trackingEnabled && (
        <div className="jrn-surface" style={{ padding: 'var(--jrn-5)', textAlign: 'center' }}>
          <svg
            width="100%"
            height="60"
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
            style={{ display: 'block', opacity: 0.35 }}
            aria-hidden="true"
          >
            <line x1="0" y1="50" x2="200" y2="50" stroke="rgba(26,46,31,.2)" strokeWidth="1" />
            <line
              x1="0" y1="30" x2="200" y2="30"
              stroke="rgba(26,46,31,.4)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle cx="10" cy="30" r="3" fill="rgba(26,46,31,.4)" />
            <circle cx="100" cy="30" r="3" fill="rgba(26,46,31,.4)" />
            <circle cx="190" cy="30" r="3" fill="rgba(26,46,31,.4)" />
          </svg>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--jrn-text-muted)', fontStyle: 'italic' }}>
            {visibleToClient
              ? 'En attente des premières pesées de la cliente depuis l\'app.'
              : 'Mode coach · aucune pesée enregistrée pour l\'instant.'}
          </p>
        </div>
      )}

      {/* V97.17.2 — placeholder "tracking desactive" plus visuel que la ligne
          de texte precedente (qui etait dans le cas isFullyEmpty plus haut). */}
      {!loading && !loadingCfg && entries.length === 0 && !trackingEnabled && (
        <div className="jrn-surface" style={{ padding: 'var(--jrn-5)' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--jrn-text-muted)' }}>
            Le suivi du poids est désactivé pour cette cliente. Active-le via le bouton ⚙ Configurer ci-dessus.
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
    <div>
      {/* V97.13.20 : label 'Bilan 4 semaines' retiré — doublon avec titre bloc cockpit */}
      <div className="jrn-surface" style={{ padding: 'var(--jrn-5)' }}>
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

// V97.17.6 — Modal clinique structurée (chips, peu de texte libre).
// Cadrage Anissa : "saisie rapide, pas une usine à gaz médicale, sinon
// elle n'utilisera plus le système après 20 clientes". 4 blocs structurés
// + 1 note libre minimaliste optionnelle.
//
// onConfirm reçoit { note, clinical } structuré.

const SYMPTOM_DIMS = [
  { key: 'digestion', label: 'Digestion' },
  { key: 'energy',    label: 'Énergie' },
  { key: 'sleep',     label: 'Sommeil' },
  { key: 'transit',   label: 'Transit' },
  { key: 'stress',    label: 'Stress' },
];

const ADHERENCE_DIMS = [
  { key: 'food',        label: 'Alimentation' },
  { key: 'supplements', label: 'Suppléments' },
];

const SYMPTOM_VALUES = [
  { value: 'good',     label: 'OK',       tone: 'ok' },
  { value: 'mixed',    label: 'Mitigé',   tone: 'mixed' },
  { value: 'bad',      label: 'Difficile', tone: 'bad' },
];

const ADHERENCE_VALUES = [
  { value: 'good',     label: 'Suivi',    tone: 'ok' },
  { value: 'partial',  label: 'Partiel',  tone: 'mixed' },
  { value: 'low',      label: 'Faible',   tone: 'bad' },
];

const EVOLUTION_VALUES = [
  { value: 'improved', label: 'Amélioré', tone: 'ok' },
  { value: 'stable',   label: 'Stable',   tone: 'neutral' },
  { value: 'worsened', label: 'Aggravé',  tone: 'bad' },
];

const DECISION_VALUES = [
  { value: 'continue',     label: 'Poursuivre la phase actuelle',  hint: 'V actuelle inchangée — rien d\'autre à faire' },
  { value: 'adapt',        label: 'Adapter le protocole',          hint: 'À l\'enregistrement → propose direct la création de la V suivante via IA' },
  { value: 'transition',   label: 'Transition vers phase suivante', hint: 'À l\'enregistrement → demande confirmation pour avancer dans le parcours' },
  { value: 'newVersion',   label: 'Nouvelle version complète',     hint: 'À l\'enregistrement → propose direct la création d\'une V suivante refondue via IA' },
];

function LogConsultationModal({ consultationNumber, totalIncluded, onCancel, onConfirm, saving, recentFeedbacks = [] }) {
  const [symptoms, setSymptoms] = useState({});
  const [adherence, setAdherence] = useState({});
  const [evolution, setEvolution] = useState(null);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');

  const hasSomething =
    Object.keys(symptoms).length > 0 ||
    Object.keys(adherence).length > 0 ||
    evolution !== null ||
    decision !== null;

  const handleConfirm = () => {
    const clinical = hasSomething ? { symptoms, adherence, evolution, decision } : null;
    onConfirm({ note: note.trim(), clinical });
  };

  return (
    <div className="jpe-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}>
      <div className="jpe-modal jpe-modal--xl">
        <header className="jpe-modal__header">
          <div>
            <p className="jrn-step-eyebrow">Suivi clinique</p>
            <h3 className="jpe-modal__title">
              Consultation n°{consultationNumber}
              {totalIncluded > 0 && <span style={{ fontSize: 14, color: 'var(--jrn-text-muted)', fontStyle: 'normal', marginLeft: 8 }}>/ {totalIncluded}</span>}
            </h3>
          </div>
          <button onClick={onCancel} disabled={saving} className="jrn-btn jrn-btn--ghost">Fermer</button>
        </header>
        <div className="jpe-modal__body">
          <p style={{ fontSize: 13, color: 'var(--jrn-text-soft)', marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
            Saisis rapidement les observations cliniques de cette consultation.
            Ces données nourrissent l'historique du dossier thérapeutique vivant et
            la prochaine adaptation IA. Tout est optionnel — clique seulement ce qui
            est pertinent.
          </p>

          {/* V97.17.23 — Contexte ressentis cliente 7 derniers jours */}
          <FeedbackContextHelper recentFeedbacks={recentFeedbacks} />

          {/* Bloc 1 — Symptômes */}
          <ClinicalSection title="1. Symptômes" eyebrow="Comment Camille a-t-elle évolué ?">
            {SYMPTOM_DIMS.map((dim) => (
              <ChipRow
                key={dim.key}
                label={dim.label}
                values={SYMPTOM_VALUES}
                selected={symptoms[dim.key]}
                onChange={(v) => setSymptoms({ ...symptoms, [dim.key]: symptoms[dim.key] === v ? undefined : v })}
                disabled={saving}
              />
            ))}
          </ClinicalSection>

          {/* Bloc 2 — Adhérence */}
          <ClinicalSection title="2. Adhérence" eyebrow="A-t-elle suivi le protocole ?">
            {ADHERENCE_DIMS.map((dim) => (
              <ChipRow
                key={dim.key}
                label={dim.label}
                values={ADHERENCE_VALUES}
                selected={adherence[dim.key]}
                onChange={(v) => setAdherence({ ...adherence, [dim.key]: adherence[dim.key] === v ? undefined : v })}
                disabled={saving}
              />
            ))}
          </ClinicalSection>

          {/* Bloc 3 — Évolution globale */}
          <ClinicalSection title="3. Évolution globale" eyebrow="Verdict d'ensemble">
            <ChipRow
              label="Tendance"
              values={EVOLUTION_VALUES}
              selected={evolution}
              onChange={(v) => setEvolution(evolution === v ? null : v)}
              disabled={saving}
            />
          </ClinicalSection>

          {/* Bloc 4 — Décision clinique */}
          <ClinicalSection title="4. Décision clinique" eyebrow="Quelle suite donner au protocole ?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DECISION_VALUES.map((d) => {
                const isSel = decision === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDecision(isSel ? null : d.value)}
                    disabled={saving}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 7,
                      border: isSel ? '1.5px solid var(--jrn-accent, #1A2E1F)' : '1px solid rgba(26,46,31,.15)',
                      background: isSel ? 'rgba(26,46,31,.06)' : 'white',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      transition: 'all 120ms ease',
                      fontFamily: 'var(--jrn-font-ui, system-ui)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2E1F' }}>
                      {isSel && '✓ '}{d.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--jrn-text-muted, #6b6f6b)', marginTop: 2 }}>
                      {d.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </ClinicalSection>

          {/* Note libre (minimaliste) */}
          <ClinicalSection title="Note interne (optionnelle)" eyebrow="Précisions complémentaires">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="jrn-textarea"
              placeholder="Précision rapide si besoin. Reste interne — non envoyée à la cliente."
              disabled={saving}
              style={{ fontSize: 13 }}
            />
          </ClinicalSection>

          <div className="jrn-actions" style={{ marginTop: 18 }}>
            <button onClick={handleConfirm} disabled={saving} className="jrn-btn jrn-btn--primary">
              {saving ? 'Enregistrement…' : '✅ Enregistrer la consultation'}
            </button>
            <button onClick={onCancel} disabled={saving} className="jrn-btn jrn-btn--ghost">
              Annuler
            </button>
            {!hasSomething && (
              <span style={{ fontSize: 11, color: 'var(--jrn-text-muted, #6b6f6b)', fontStyle: 'italic', marginLeft: 8 }}>
                Tu peux aussi enregistrer sans rien renseigner (consultation logguée sans suivi clinique structuré).
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers internes pour LogConsultationModal ──────────────────────────

// V97.17.23 — Helper : resume des ressentis cliente sur 7 derniers jours.
// Affiche en haut de la modal clinique un encart de contexte (Anissa decide
// en connaissance de cause sans biais d'auto-fill).

const FEEDBACK_DIMS = [
  { key: 'digestion', label: 'Digestion', values: { better: 'Mieux', same: 'Pareil', worse: 'Pire' } },
  { key: 'fatigue',   label: 'Fatigue',   values: { better: 'Mieux', same: 'Pareil', worse: 'Pire' } },
  { key: 'energie',   label: 'Energie',   values: { good: 'Bonne', ok: 'OK', low: 'Basse' } },
  { key: 'faim',      label: 'Faim',      values: { low: 'Pas assez', ok: 'OK', high: 'Trop' } },
];

function FeedbackContextHelper({ recentFeedbacks }) {
  if (!Array.isArray(recentFeedbacks) || recentFeedbacks.length === 0) return null;

  // Pour chaque dimension : compter occurrences par valeur, trouver dominante
  const summaries = FEEDBACK_DIMS.map((dim) => {
    const counts = {};
    for (const f of recentFeedbacks) {
      const v = f[dim.key];
      if (!v) continue;
      counts[v] = (counts[v] || 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    const [topValue, topCount] = entries[0];
    return {
      dim,
      label: dim.values[topValue] || topValue,
      count: topCount,
      total: recentFeedbacks.length,
    };
  }).filter(Boolean);

  if (summaries.length === 0) {
    return (
      <div style={{
        padding: '10px 12px',
        background: 'rgba(26, 46, 31, 0.04)',
        border: '1px dashed rgba(26, 46, 31, 0.15)',
        borderRadius: 7,
        marginBottom: 16,
        fontSize: 11.5,
        color: 'var(--jrn-text-muted, #6b6f6b)',
        fontStyle: 'italic',
      }}>
        Aucun ressenti cliente reçu sur les 7 derniers jours.
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(26, 46, 31, 0.04)',
      border: '1px solid rgba(26, 46, 31, 0.10)',
      borderRadius: 7,
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'var(--jrn-text-muted, #6b6f6b)',
        marginBottom: 6,
      }}>
        Contexte ressentis · 7 derniers jours
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {summaries.map((s) => (
          <span
            key={s.dim.key}
            style={{
              fontSize: 11,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'white',
              color: '#1A2E1F',
              border: '1px solid rgba(26, 46, 31, 0.10)',
              fontFamily: 'var(--jrn-font-ui, system-ui)',
            }}
            title={`Dominante sur ${s.total} ressentis`}
          >
            <strong>{s.dim.label}</strong>{' '}
            <span style={{ opacity: 0.7 }}>· dominante {s.label}</span>{' '}
            <span style={{ fontSize: 10, color: 'var(--jrn-text-muted, #6b6f6b)' }}>
              ({s.count}/{s.total})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ClinicalSection({ title, eyebrow, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--jrn-text-muted, #6b6f6b)' }}>
          {eyebrow}
        </p>
        <h4 style={{ margin: '2px 0 0 0', fontSize: 14, color: '#1A2E1F', fontWeight: 600 }}>{title}</h4>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ChipRow({ label, values, selected, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--jrn-text, #1A2E1F)', minWidth: 110, fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {values.map((v) => {
          const isSel = selected === v.value;
          const toneStyles = chipToneStyles(v.tone, isSel);
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => onChange(v.value)}
              disabled={disabled}
              style={{
                ...chipBaseStyle,
                ...toneStyles,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const chipBaseStyle = {
  border: '1px solid rgba(26,46,31,.15)',
  background: 'white',
  borderRadius: 999,
  padding: '5px 12px',
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--jrn-text-muted, #6b6f6b)',
  transition: 'all 120ms ease',
  fontFamily: 'var(--jrn-font-ui, system-ui)',
};

function chipToneStyles(tone, isSelected) {
  if (!isSelected) return {};
  switch (tone) {
    case 'ok':
      return { background: 'rgba(46, 94, 62, 0.12)', borderColor: 'rgba(46, 94, 62, 0.5)', color: '#2E5E3E' };
    case 'mixed':
      return { background: 'rgba(184, 134, 38, 0.12)', borderColor: 'rgba(184, 134, 38, 0.5)', color: '#785a1a' };
    case 'bad':
      return { background: 'rgba(160, 64, 64, 0.10)', borderColor: 'rgba(160, 64, 64, 0.5)', color: '#a04040' };
    case 'neutral':
    default:
      return { background: 'rgba(26, 46, 31, 0.08)', borderColor: 'rgba(26, 46, 31, 0.35)', color: '#1A2E1F' };
  }
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
