// ─── ClientAppPreviewModal ──────────────────────────────────────────────
// Modale d'aperçu du JSON ClientPlan tel qu'il sera envoyé à l'app
// cliente premium (anissa-client-preview).
//
// V1 — étape "à blanc" : lecture seule du JSON construit via le mapper.
// Permet de valider visuellement le mapping avant migration DB + bouton
// "Publier dans l'app". Aucun appel réseau, aucune écriture.
//
// Props :
//   - client       : ligne `clients` du SaaS
//   - consultation : ligne `nutrition_consultations` (état COURANT, pas
//                    nécessairement persisté — c'est readEdited() qui le
//                    nourrit côté caller)
//   - onClose      : fermer la modale
//
// ⚠️  La modale recompute le JSON à chaque ouverture (cheap, le mapper
// est pur). Pas de cache, pas de sync.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildClientAppPlanFromConsultation,
  diagnoseClientAppPlan,
} from './services/clientAppMapper';
import {
  publishConsultationToClientApp,
  checkPublishConfig,
  PublishConfigError,
  PublishHttpError,
} from './services/publishToClientApp';
import {
  enrichClientAppPlan,
  applyEnrichmentToPlan,
  EnrichConfigError,
  EnrichHttpError,
} from './services/aiEnrichClientPlan';

const TABS = [
  { id: 'json',       label: 'JSON complet' },
  { id: 'sections',   label: 'Aperçu sections' },
  { id: 'diagnostic', label: 'Diagnostic' },
];

export default function ClientAppPreviewModal({ client, consultation, autoEnrich = false, onClose }) {
  const [tab, setTab] = useState('sections');
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null); // { ok, plan_id, login_url, app_url, ... }
  const [publishError, setPublishError] = useState(null);
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  // ─── État enrichissement IA ─────────────────────────────────────────
  const [enriching, setEnriching] = useState(false);
  const [enrichmentDraft, setEnrichmentDraft] = useState(null); // proposition IA pas encore acceptée
  const [enrichmentApplied, setEnrichmentApplied] = useState(null); // accepté → injecté dans le plan publié
  const [enrichmentError, setEnrichmentError] = useState(null);

  // Construire le plan brut. useMemo évite recompute à chaque changement de
  // tab — la dépendance est l'identité des inputs.
  const { rawPlan, error } = useMemo(() => {
    try {
      const p = buildClientAppPlanFromConsultation(client, consultation);
      return { rawPlan: p, error: null };
    } catch (err) {
      // V94.67 : log le stack complet en console pour diagnostic.
      // Le message UI seul ("e is undefined at split") ne dit pas QUEL .split
      // a planté ni avec quel input. Le stack pointe vers la ligne exacte du
      // mapper, indispensable pour corriger sans patcher a l'aveugle.
      // eslint-disable-next-line no-console
      console.error('[ClientAppPreviewModal] mapping error', err, {
        clientId: client?.id,
        consultationId: consultation?.id,
      });
      return { rawPlan: null, error: err?.message || String(err) };
    }
  }, [client, consultation]);

  // Plan affiché = brut + enrichissement appliqué si présent
  const plan = useMemo(
    () => (rawPlan && enrichmentApplied ? applyEnrichmentToPlan(rawPlan, enrichmentApplied) : rawPlan),
    [rawPlan, enrichmentApplied],
  );
  const diag = useMemo(() => (plan ? diagnoseClientAppPlan(plan) : null), [plan]);

  const cfgCheck = useMemo(() => checkPublishConfig(), []);
  const clientEmail = client?.form?.email || client?.email || null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handlePublish = async (options = {}) => {
    setPublishError(null);
    setPublishResult(null);
    setPublishing(true);
    try {
      // V96.0 : options.effectiveAtOverride pour le bouton "Publier maintenant"
      // (force visible immédiate sur un plan de suivi).
      const res = await publishConsultationToClientApp(
        client,
        consultation,
        enrichmentApplied,
        options,
      );
      setPublishResult(res);
    } catch (err) {
      if (err instanceof PublishConfigError) {
        setPublishError(`Config : ${err.message}`);
      } else if (err instanceof PublishHttpError) {
        setPublishError(`Erreur publication (${err.status}) : ${err.message}`);
      } else {
        setPublishError(err?.message || String(err));
      }
    } finally {
      setPublishing(false);
      setConfirmingPublish(false);
    }
  };

  const handleEnrich = async () => {
    if (!rawPlan) return;
    setEnrichmentError(null);
    setEnrichmentDraft(null);
    setEnriching(true);
    try {
      // On appelle l'IA sur le plan BRUT (sans enrichissement préexistant)
      // pour qu'elle reparte de la matière source à chaque génération.
      const enrichment = await enrichClientAppPlan(rawPlan, client);
      setEnrichmentDraft(enrichment);
    } catch (err) {
      if (err instanceof EnrichConfigError) {
        setEnrichmentError(`Config : ${err.message}`);
      } else if (err instanceof EnrichHttpError) {
        setEnrichmentError(`Erreur IA (${err.status}) : ${err.message}`);
      } else {
        setEnrichmentError(err?.message || String(err));
      }
    } finally {
      setEnriching(false);
    }
  };

  const handleAcceptEnrichment = () => {
    setEnrichmentApplied(enrichmentDraft);
    setEnrichmentDraft(null);
  };

  const handleRejectEnrichment = () => {
    setEnrichmentDraft(null);
  };

  const handleResetEnrichment = () => {
    setEnrichmentApplied(null);
    setEnrichmentDraft(null);
  };

  // V97.13.27 — auto-trigger Enrichir IA quand la modal s'ouvre depuis le
  // bouton 'Enrichir le plan avec IA' du cockpit étape 7. Anissa voit le
  // résultat directement, sans avoir à cliquer Enrichir manuellement.
  const autoEnrichTriggered = useRef(false);
  useEffect(() => {
    if (autoEnrich && rawPlan && !autoEnrichTriggered.current && !enriching && !enrichmentDraft && !enrichmentApplied) {
      autoEnrichTriggered.current = true;
      handleEnrich();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnrich, rawPlan]);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu app cliente"
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: 0,
          maxWidth: 1280,
          width: '94vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: '#d4c9a8', fontSize: '1.1rem', fontWeight: 700 }}>
              Espace cliente de {client?.prenom || 'la cliente'}
            </h3>
            <div style={{ fontSize: '.78rem', color: '#8a8a7a', marginTop: 3 }}>
              Voici ce que {client?.prenom || 'la cliente'} verra dans son app — vérifie chaque section avant publication.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleEnrich}
              disabled={!rawPlan || enriching}
              style={{
                background: enrichmentApplied
                  ? 'rgba(120,80,200,.15)'
                  : 'rgba(120,80,200,.08)',
                border: `1px solid ${enrichmentApplied ? 'rgba(180,140,255,.4)' : 'rgba(180,140,255,.25)'}`,
                color: enrichmentApplied ? '#cba8ff' : '#b89eff',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: '.82rem',
                fontWeight: 600,
                cursor: enriching ? 'wait' : 'pointer',
                opacity: enriching ? 0.6 : 1,
              }}
              title="L'IA enrichit l'intro narrative, ajoute des points clés et signature. Anissa garde le contrôle."
            >
              {enriching
                ? '✨ Génération…'
                : enrichmentApplied
                  ? '✨ Enrichi ✓'
                  : '✨ Enrichir avec IA'}
            </button>
            {/* V97.13.28 — Bouton dev caché : double clic pour afficher détails techniques */}
            <button
              type="button"
              onClick={() => setTab(tab === 'sections' ? 'diagnostic' : 'sections')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#555',
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '4px 8px',
                opacity: 0.5,
              }}
              title="Mode développeur (Diagnostic + JSON)"
            >
              {tab === 'sections' ? '🔧' : '👁'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#8a8a7a',
                fontSize: '1.3rem',
                cursor: 'pointer',
                padding: '0 4px',
              }}
              title="Fermer"
            >
              &times;
            </button>
          </div>
        </header>

        {/* V97.13.28 — Onglets techniques cachés par défaut.
            Visibles uniquement en mode dev (tab !== 'sections') déclenché par le bouton 🔧 du header. */}
        {tab !== 'sections' && (
          <div
            role="tablist"
            aria-label="Vue (mode dev)"
            style={{
              display: 'flex',
              gap: 4,
              padding: '10px 22px 0',
              borderBottom: '1px solid rgba(255,255,255,.06)',
              background: 'rgba(80, 30, 30, 0.10)',
            }}
          >
            <span style={{ alignSelf: 'center', marginRight: 12, fontSize: '0.7rem', color: '#a86060', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ⚙ Dev mode
            </span>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    background: active ? 'rgba(212,201,168,.1)' : 'transparent',
                    border: 'none',
                    borderBottom: active ? '2px solid #d4c9a8' : '2px solid transparent',
                    color: active ? '#d4c9a8' : '#8a8a7a',
                    padding: '8px 14px',
                    fontSize: '.82rem',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!plan}
              style={{
                marginLeft: 'auto',
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.1)',
                color: '#d4c9a8',
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: '.75rem',
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copié' : 'Copier JSON'}
            </button>
          </div>
        )}

        {/* Bloc proposition IA (visible UNIQUEMENT si l'IA a renvoyé un draft non encore accepté) */}
        {(enrichmentDraft || enrichmentError || enrichmentApplied) && (
          <EnrichmentBanner
            draft={enrichmentDraft}
            applied={enrichmentApplied}
            error={enrichmentError}
            onAccept={handleAcceptEnrichment}
            onReject={handleRejectEnrichment}
            onReset={handleResetEnrichment}
            onRegenerate={handleEnrich}
            regenerating={enriching}
          />
        )}

        {/* Corps — V97.13.32 : layout 2 colonnes (phone sticky + sections scroll) */}
        <div className="jrn-app-preview-body">
          {/* Colonne gauche : aperçu téléphone sticky (uniquement en mode sections) */}
          {tab === 'sections' && (
            <aside className="jrn-app-preview-phone" aria-hidden="true">
              <ClientPhoneMockup client={client} plan={plan} />
              <div className="jrn-app-preview-phone__caption">
                Vue côté {client?.prenom || 'cliente'}
                <span>— rendu indicatif, l'app réelle peut varier légèrement.</span>
              </div>
            </aside>
          )}

          {/* Colonne droite : sections scrollable */}
          <div className="jrn-app-preview-content">
            {error && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  background: 'rgba(220,80,80,.1)',
                  border: '1px solid rgba(220,80,80,.3)',
                  color: '#f5c6c6',
                  fontSize: '.85rem',
                  marginBottom: 12,
                }}
              >
                <strong>Erreur de mapping :</strong> {error}
              </div>
            )}

            {plan && tab === 'json' && (
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: '.78rem',
                  lineHeight: 1.5,
                  color: '#cfcfc4',
                  background: 'rgba(0,0,0,.25)',
                  padding: 14,
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(plan, null, 2)}
              </pre>
            )}

            {plan && tab === 'sections' && <SectionsOverview plan={plan} />}

            {plan && tab === 'diagnostic' && diag && <DiagnosticView diag={diag} />}
          </div>
        </div>

        {/* Footer publication */}
        <PublishFooter
          cfgCheck={cfgCheck}
          clientEmail={clientEmail}
          plan={plan}
          publishing={publishing}
          publishResult={publishResult}
          publishError={publishError}
          confirming={confirmingPublish}
          followupWeek={Number(consultation?.followupWeek) || 0}
          onAskConfirm={() => { setConfirmingPublish(true); setPublishError(null); }}
          onCancel={() => setConfirmingPublish(false)}
          onConfirm={handlePublish}
        />
      </div>
    </div>
  );
}

// ─── Footer publication ──────────────────────────────────────────────────
//
// Affiche : config/cliente check → bouton "Publier" → confirm → status →
// résultat avec lien "Voir dans l'app".

function PublishFooter({
  cfgCheck, clientEmail, plan,
  publishing, publishResult, publishError, confirming,
  followupWeek = 0,
  onAskConfirm, onCancel, onConfirm,
}) {
  const blockedReasons = [];
  if (!plan) blockedReasons.push('Mapping en erreur');
  if (!cfgCheck.ok) blockedReasons.push('Config publication manquante');
  if (!clientEmail) blockedReasons.push('Cliente sans email');

  // V96.0 — message de gating temporel selon followupWeek
  // 0 = plan initial → visible tout de suite
  // 1 = S4, 2 = S8, 3 = S12, 4 = S16 → visible N×4 semaines après le plan initial
  const isFollowup = followupWeek > 0;
  const followupLabel = isFollowup ? `S${followupWeek * 4}` : null;
  const weeksAfterInitial = followupWeek * 4;

  const canPublish = blockedReasons.length === 0 && !publishing;

  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255,255,255,.08)',
        padding: '14px 22px',
        background: 'rgba(0,0,0,.15)',
      }}
    >
      {/* État succès */}
      {publishResult?.ok && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(80,160,100,.1)',
            border: '1px solid rgba(80,160,100,.3)',
            color: '#b6d8b8',
            fontSize: '.85rem',
            marginBottom: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div>
            ✓ Plan publié — version {publishResult.published_version}
          </div>
          {/* V96.0 : si effective_at futur, indiquer la date à laquelle la
              cliente verra ce plan. Sinon "visible immédiatement". */}
          {publishResult.effective_at && (
            (() => {
              const eff = new Date(publishResult.effective_at);
              const now = new Date();
              const diffDays = Math.round((eff.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays > 0) {
                return (
                  <div style={{ fontSize: '.78rem', color: '#e5c878' }}>
                    Visible par la cliente le {eff.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} (dans {diffDays} jours).
                  </div>
                );
              }
              return null;
            })()
          )}
          <div style={{ fontSize: '.75rem', color: '#8eb892' }}>
            La cliente peut se connecter avec <strong>{clientEmail}</strong>.
          </div>
          {publishResult.login_url && (
            <a
              href={publishResult.login_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#b6d8b8',
                fontSize: '.78rem',
                textDecoration: 'underline',
              }}
            >
              Ouvrir l'app cliente ({publishResult.login_url})
            </a>
          )}
        </div>
      )}

      {/* État erreur */}
      {publishError && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(220,80,80,.1)',
            border: '1px solid rgba(220,80,80,.3)',
            color: '#f5c6c6',
            fontSize: '.82rem',
            marginBottom: 10,
          }}
        >
          ✗ {publishError}
        </div>
      )}

      {/* Raisons bloquantes */}
      {blockedReasons.length > 0 && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: 'rgba(220,180,80,.08)',
            border: '1px solid rgba(220,180,80,.25)',
            color: '#e5c878',
            fontSize: '.78rem',
            marginBottom: 10,
          }}
        >
          ⚠ Publication bloquée : {blockedReasons.join(' • ')}
          {!cfgCheck.ok && cfgCheck.issues.length > 0 && (
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {cfgCheck.issues.map((iss, i) => (
                <li key={i}>{iss}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Bouton confirm OU bouton publier */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {confirming ? (
          <>
            <span style={{ fontSize: '.78rem', color: '#cfcfc4', marginRight: 'auto', flex: '1 1 auto', minWidth: 200 }}>
              {isFollowup ? (
                <>
                  Plan <strong>{followupLabel}</strong> de <strong>{clientEmail}</strong> — visible {weeksAfterInitial} semaines après le plan initial.
                </>
              ) : (
                <>
                  Publier vers <strong>{clientEmail}</strong> ? Visible immédiatement.
                  {publishResult?.ok && ' (Ré-publication — nouvelle version, ancienne archivée.)'}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onCancel}
              disabled={publishing}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.15)',
                color: '#8a8a7a',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: '.82rem',
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            {/* V96.0 : bouton override "Publier maintenant" sur les suivis,
                au cas où Anissa veut bypass le gating (ex: la cliente est en
                avance et veut son S4 tout de suite). */}
            {isFollowup && (
              <button
                type="button"
                onClick={() => onConfirm({ effectiveAtOverride: new Date().toISOString() })}
                disabled={publishing}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(229,200,120,.4)',
                  color: '#e5c878',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: '.78rem',
                  cursor: publishing ? 'wait' : 'pointer',
                  opacity: publishing ? 0.6 : 1,
                }}
                title="Override : visible par la cliente immédiatement, sans attendre les 4 semaines"
              >
                Publier le programme maintenant
              </button>
            )}
            <button
              type="button"
              onClick={() => onConfirm()}
              disabled={publishing}
              style={{
                background: '#2E4E38',
                border: '1px solid #2E4E38',
                color: '#FAF9F6',
                padding: '8px 18px',
                borderRadius: 6,
                fontSize: '.82rem',
                fontWeight: 600,
                cursor: publishing ? 'wait' : 'pointer',
                opacity: publishing ? 0.6 : 1,
              }}
            >
              {publishing ? 'Publication…' : isFollowup ? 'Programmer la publication' : 'Confirmer'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onAskConfirm}
            disabled={!canPublish}
            style={{
              background: canPublish ? '#2E4E38' : 'rgba(255,255,255,.05)',
              border: `1px solid ${canPublish ? '#2E4E38' : 'rgba(255,255,255,.1)'}`,
              color: canPublish ? '#FAF9F6' : '#666',
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: '.85rem',
              fontWeight: 600,
              cursor: canPublish ? 'pointer' : 'not-allowed',
            }}
            title={canPublish ? 'Publier le programme dans l\'app cliente' : blockedReasons.join(' • ')}
          >
            {publishResult?.ok ? '↻ Re-publier' : '🚀 Publier le programme'}
          </button>
        )}
      </div>
    </footer>
  );
}

// ─── Aperçu sections (vue lisible) ──────────────────────────────────────

// V97.13.28 — Refonte UX premium :
// Au lieu de compteurs techniques + "manquants post-migration", on affiche
// les vraies données de chaque section de l'app cliente, en formatage
// clinique premium. Anissa voit immédiatement ce que Camille verra.
//
// Pas d'onglets techniques visibles, pas de jargon. Vue verticale claire.
function SectionsOverview({ plan }) {
  const s = plan.sections || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Lettre d'intro ────────────────────────────────────────── */}
      <CapsCard
        icon="✉️"
        title="Lettre d'intro"
        empty={!s.intro_data?.body?.length}
        emptyLabel="Pas encore de lettre d'intro générée"
      >
        {s.intro_data?.greeting && (
          <p style={capsGreetingStyle}>{s.intro_data.greeting}</p>
        )}
        {s.intro_data?.body?.map((para, i) => (
          <p key={i} style={capsBodyStyle}>{para}</p>
        ))}
        {s.intro_data?.pull_quote && (
          <blockquote style={capsQuoteStyle}>« {s.intro_data.pull_quote} »</blockquote>
        )}
        {s.intro_data?.tailored_points?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {s.intro_data.tailored_points.map((tp, i) => (
              <div key={tp.id || i} style={{ marginBottom: 10 }}>
                <div style={capsPointTitleStyle}>{tp.title}</div>
                <div style={capsPointDetailStyle}>{tp.detail}</div>
              </div>
            ))}
          </div>
        )}
        {s.intro_data?.signature && (
          <p style={capsSignatureStyle}>— {s.intro_data.signature}</p>
        )}
      </CapsCard>

      {/* ─── Stratégie & piliers ───────────────────────────────────── */}
      <CapsCard
        icon="🎯"
        title="Stratégie"
        subtitle={s.strategy_data?.subtitle}
        empty={!s.strategy_data?.pillars?.length}
        emptyLabel="Pas de piliers détectés dans la stratégie"
      >
        {s.strategy_data?.essential?.length > 0 && s.strategy_data.essential.map((p, i) => (
          <p key={i} style={capsBodyStyle}>{p}</p>
        ))}
        {s.strategy_data?.pillars?.length > 0 && (
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {s.strategy_data.pillars.map((p) => (
              <div key={p.id} style={capsPillarStyle}>
                <div style={capsPillarTitleStyle}>{p.title}</div>
                <div style={capsPillarDescStyle}>{p.description}</div>
              </div>
            ))}
          </div>
        )}
        {s.strategy_data?.takeaways?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={capsSubTitleStyle}>{s.strategy_data.takeaways_title || 'À retenir'}</div>
            <ul style={capsListStyle}>
              {s.strategy_data.takeaways.map((t, i) => (
                <li key={i} style={capsListItemStyle}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </CapsCard>

      {/* ─── Semaine 1 ─────────────────────────────────────────────── */}
      <CapsCard
        icon="📅"
        title="Semaine type"
        subtitle={s.week_meals?.days?.length
          ? `${s.week_meals.days.length} jours · ${s.week_meals.days[0]?.meals?.length || 0} repas/jour`
          : null}
        empty={!s.week_meals?.days?.length}
        emptyLabel="Aucun repas généré"
      >
        {s.week_meals?.days?.[0]?.meals?.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {s.week_meals.days[0].meals.map((m) => (
              <div key={m.id} style={capsMealStyle}>
                <div style={capsMealSlotStyle}>{m.slot_label}</div>
                <div style={capsMealTitleStyle}>{m.title}</div>
                {m.alternatives?.length > 0 && (
                  <div style={capsMealAltsStyle}>
                    {m.alternatives.length} alternative{m.alternatives.length > 1 ? 's' : ''} disponible{m.alternatives.length > 1 ? 's' : ''}
                  </div>
                )}
                {m.recipe && (
                  <div style={capsMealRecipeStyle}>🍳 Recette détaillée</div>
                )}
              </div>
            ))}
          </div>
        )}
      </CapsCard>

      {/* ─── Frigo ─────────────────────────────────────────────────── */}
      <CapsCard
        icon="🧊"
        title="Frigo & courses"
        subtitle={s.fridge_data?.header_title}
        empty={!s.fridge_data?.essentials?.length && !s.fridge_data?.favorite?.length}
        emptyLabel="Pas encore de fiche frigo"
      >
        {s.fridge_data?.essentials?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={capsSubTitleStyle}>{s.fridge_data.essentials_title || 'Essentiels'}</div>
            <div style={capsPillsStyle}>
              {s.fridge_data.essentials.map((e) => (
                <span key={e.id} style={capsPillStyle}>{e.label}</span>
              ))}
            </div>
          </div>
        )}
        {s.fridge_data?.favorite?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {s.fridge_data.favorite.map((cat) => (
              <div key={cat.id} style={{ marginBottom: 8 }}>
                <div style={capsSubTitleStyle}>✓ {cat.title}</div>
                <div style={capsPillsStyle}>
                  {cat.items?.map((it) => (
                    <span key={it.id} style={capsPillStyle}>{it.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {s.fridge_data?.limit?.length > 0 && (
          <div>
            {s.fridge_data.limit.map((cat) => (
              <div key={cat.id} style={{ marginBottom: 8 }}>
                <div style={capsSubTitleStyle}>⚠ {cat.title}</div>
                <div style={capsPillsStyle}>
                  {cat.items?.map((it) => (
                    <span key={it.id} style={{ ...capsPillStyle, ...capsPillLimitStyle }}>{it.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CapsCard>

      {/* ─── Compléments ──────────────────────────────────────────── */}
      <CapsCard
        icon="💊"
        title="Compléments"
        subtitle={s.protocols_data?.header_title}
        empty={!s.protocols_data?.groups?.length}
        emptyLabel="Pas de compléments détectés"
      >
        {s.protocols_data?.groups?.length > 0 && s.protocols_data.groups.map((g) => (
          <div key={g.id} style={{ marginBottom: 12 }}>
            <div style={capsSubTitleStyle}>{g.title}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {g.items?.map((it) => (
                <div key={it.id} style={capsCompStyle}>
                  <div style={capsCompNameStyle}>{it.name}</div>
                  {it.dose && <div style={capsCompMetaStyle}>📦 {it.dose}</div>}
                  {it.timing_detail && <div style={capsCompMetaStyle}>⏰ {it.timing_detail}</div>}
                  {it.benefit && <div style={capsCompBenefitStyle}>{it.benefit}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CapsCard>

      {/* ─── Rotation (compact si vide) ───────────────────────────── */}
      {s.rotation_data?.categories?.length > 0 && (
        <CapsCard
          icon="🔄"
          title="Rotation alimentaire"
          subtitle={`${s.rotation_data.categories.length} catégories`}
          empty={false}
        >
          {s.rotation_data.categories.map((c) => (
            <div key={c.id} style={{ marginBottom: 6 }}>
              <span style={capsSubTitleStyle}>{c.title}{c.primary ? ' ★' : ''}</span>
              <span style={{ color: '#8a8a7a', fontSize: '.78rem', marginLeft: 8 }}>
                {c.items?.length || 0} alternatives
              </span>
            </div>
          ))}
        </CapsCard>
      )}
    </div>
  );
}

// ─── Card premium pour l'aperçu Anissa ────────────────────────────────
function CapsCard({ icon, title, subtitle, empty, emptyLabel, children }) {
  return (
    <div style={capsCardStyle}>
      <header style={capsCardHeaderStyle}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <h4 style={capsCardTitleStyle}>{title}</h4>
          {subtitle && <p style={capsCardSubtitleStyle}>{subtitle}</p>}
        </div>
        {empty && <span style={capsCardBadgeStyle}>à enrichir</span>}
      </header>
      <div style={capsCardBodyStyle}>
        {empty ? (
          <p style={capsEmptyStyle}>{emptyLabel}</p>
        ) : children}
      </div>
    </div>
  );
}

// ─── Styles premium app cliente preview ──────────────────────────────
const capsCardStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 12,
  padding: 0,
  overflow: 'hidden',
};
const capsCardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  background: 'rgba(212, 201, 168, 0.04)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
};
const capsCardTitleStyle = {
  margin: 0,
  color: '#d4c9a8',
  fontSize: '0.92rem',
  fontWeight: 600,
  letterSpacing: '-0.005em',
};
const capsCardSubtitleStyle = {
  margin: '2px 0 0',
  color: '#8a8a7a',
  fontSize: '0.74rem',
};
const capsCardBadgeStyle = {
  padding: '3px 10px',
  background: 'rgba(220, 180, 80, 0.12)',
  border: '1px solid rgba(220, 180, 80, 0.30)',
  borderRadius: 999,
  color: '#e5c878',
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const capsCardBodyStyle = {
  padding: '14px 16px',
};
const capsEmptyStyle = {
  margin: 0,
  color: '#666',
  fontSize: '0.82rem',
  fontStyle: 'italic',
};
// Intro
const capsGreetingStyle = {
  margin: '0 0 10px',
  color: '#d4c9a8',
  fontSize: '1rem',
  fontWeight: 500,
  fontStyle: 'italic',
  letterSpacing: '-0.005em',
};
const capsBodyStyle = {
  margin: '0 0 8px',
  color: '#cfcfc4',
  fontSize: '0.86rem',
  lineHeight: 1.55,
};
const capsQuoteStyle = {
  margin: '12px 0 0',
  padding: '10px 14px',
  borderLeft: '3px solid #d4c9a8',
  background: 'rgba(212, 201, 168, 0.04)',
  color: '#d4c9a8',
  fontSize: '0.88rem',
  fontStyle: 'italic',
  lineHeight: 1.5,
};
const capsPointTitleStyle = {
  fontFamily: 'system-ui',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#d4c9a8',
  marginBottom: 3,
};
const capsPointDetailStyle = {
  color: '#cfcfc4',
  fontSize: '0.82rem',
  lineHeight: 1.5,
};
const capsSignatureStyle = {
  margin: '12px 0 0',
  color: '#8a8a7a',
  fontSize: '0.84rem',
  fontStyle: 'italic',
};
// Stratégie
const capsPillarStyle = {
  padding: 12,
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 8,
};
const capsPillarTitleStyle = {
  color: '#d4c9a8',
  fontSize: '0.86rem',
  fontWeight: 600,
  marginBottom: 4,
};
const capsPillarDescStyle = {
  color: '#cfcfc4',
  fontSize: '0.8rem',
  lineHeight: 1.5,
};
const capsSubTitleStyle = {
  color: '#d4c9a8',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
};
const capsListStyle = {
  margin: '4px 0 0',
  padding: 0,
  listStyle: 'none',
};
const capsListItemStyle = {
  padding: '4px 0 4px 18px',
  position: 'relative',
  color: '#cfcfc4',
  fontSize: '0.82rem',
  lineHeight: 1.45,
};
// Semaine
const capsMealStyle = {
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.03)',
  borderLeft: '2px solid #d4c9a8',
  borderRadius: '0 6px 6px 0',
};
const capsMealSlotStyle = {
  color: '#d4c9a8',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 3,
};
const capsMealTitleStyle = {
  color: '#cfcfc4',
  fontSize: '0.85rem',
  lineHeight: 1.45,
};
const capsMealAltsStyle = {
  marginTop: 4,
  color: '#9b9b89',
  fontSize: '0.72rem',
};
const capsMealRecipeStyle = {
  marginTop: 4,
  color: '#a8e890',
  fontSize: '0.72rem',
  fontWeight: 600,
};
// Frigo
const capsPillsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};
const capsPillStyle = {
  padding: '4px 10px',
  background: 'rgba(212, 201, 168, 0.08)',
  border: '1px solid rgba(212, 201, 168, 0.18)',
  borderRadius: 999,
  color: '#d4c9a8',
  fontSize: '0.76rem',
};
const capsPillLimitStyle = {
  background: 'rgba(220, 140, 80, 0.06)',
  border: '1px solid rgba(220, 140, 80, 0.20)',
  color: '#e3a878',
};
// Compléments
const capsCompStyle = {
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 8,
};
const capsCompNameStyle = {
  color: '#d4c9a8',
  fontSize: '0.84rem',
  fontWeight: 600,
  marginBottom: 4,
};
const capsCompMetaStyle = {
  color: '#9b9b89',
  fontSize: '0.74rem',
  marginTop: 2,
};
const capsCompBenefitStyle = {
  marginTop: 6,
  paddingTop: 6,
  borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
  color: '#cfcfc4',
  fontSize: '0.78rem',
  fontStyle: 'italic',
  lineHeight: 1.4,
};

function Meta({ plan }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'rgba(212,201,168,.06)',
        border: '1px solid rgba(212,201,168,.15)',
        borderRadius: 8,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 18,
        fontSize: '.78rem',
      }}
    >
      <span style={{ color: '#8a8a7a' }}>
        Locale : <strong style={{ color: '#d4c9a8' }}>{plan.locale}</strong>
      </span>
      <span style={{ color: '#8a8a7a' }}>
        Mode : <strong style={{ color: '#d4c9a8' }}>{plan.mode}</strong>
      </span>
      <span style={{ color: '#8a8a7a' }}>
        Status : <strong style={{ color: '#d4c9a8' }}>{plan.status}</strong>
      </span>
      {plan.objective && (
        <span style={{ color: '#8a8a7a' }}>
          Objectif : <strong style={{ color: '#d4c9a8' }}>{plan.objective}</strong>
        </span>
      )}
    </div>
  );
}

function SectionCard({ title, empty, children }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 8,
        background: empty ? 'rgba(220,180,80,.05)' : 'rgba(255,255,255,.03)',
        border: `1px solid ${empty ? 'rgba(220,180,80,.25)' : 'rgba(255,255,255,.08)'}`,
      }}
    >
      <h4
        style={{
          margin: '0 0 10px',
          color: empty ? '#e5c878' : '#d4c9a8',
          fontSize: '.92rem',
          fontWeight: 600,
        }}
      >
        {title}
        {empty && (
          <span style={{ marginLeft: 8, fontSize: '.7rem', fontWeight: 400 }}>
            ⚠️ vide
          </span>
        )}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function KV({ label, value, indent }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        fontSize: '.78rem',
        paddingLeft: indent ? 8 : 0,
      }}
    >
      <span style={{ color: '#8a8a7a', minWidth: 160 }}>{label}</span>
      <span style={{ color: value ? '#cfcfc4' : '#666', fontStyle: value ? 'normal' : 'italic' }}>
        {value || '—'}
      </span>
    </div>
  );
}

function Missing({ fields }) {
  const missing = fields.filter(([, v]) => !v).map(([k]) => k);
  if (!missing.length) return null;
  return (
    <div
      style={{
        marginTop: 6,
        fontSize: '.72rem',
        color: '#8a8a7a',
        fontStyle: 'italic',
      }}
    >
      Manquants (post-migration) : {missing.join(', ')}
    </div>
  );
}

function Note({ children }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '6px 10px',
        background: 'rgba(80,140,200,.08)',
        border: '1px solid rgba(80,140,200,.2)',
        borderRadius: 6,
        fontSize: '.74rem',
        color: '#9bbed8',
      }}
    >
      {children}
    </div>
  );
}

// ─── Banner enrichissement IA ────────────────────────────────────────────

function EnrichmentBanner({ draft, applied, error, onAccept, onReject, onReset, onRegenerate, regenerating }) {
  // Cas erreur
  if (error && !draft && !applied) {
    return (
      <div
        style={{
          margin: '0 22px 12px',
          padding: 12,
          borderRadius: 8,
          background: 'rgba(220,80,80,.08)',
          border: '1px solid rgba(220,80,80,.25)',
          color: '#f5c6c6',
          fontSize: '.82rem',
        }}
      >
        ✗ Enrichissement IA échoué : {error}
      </div>
    );
  }

  // Cas appliqué (Anissa a accepté)
  if (applied && !draft) {
    return (
      <div
        style={{
          margin: '0 22px 12px',
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(120,80,200,.1)',
          border: '1px solid rgba(180,140,255,.3)',
          color: '#cba8ff',
          fontSize: '.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span>
          ✨ Enrichissement IA appliqué — visible dans l'aperçu ci-dessous + sera publié.
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            style={miniBtn('purple')}
          >
            ↺ Regénérer
          </button>
          <button type="button" onClick={onReset} style={miniBtn('ghost')}>
            Annuler enrichissement
          </button>
        </div>
      </div>
    );
  }

  // Cas draft (proposition IA pas encore acceptée)
  if (!draft) return null;

  return (
    <div
      style={{
        margin: '0 22px 12px',
        padding: 14,
        borderRadius: 10,
        background: 'rgba(120,80,200,.08)',
        border: '1px solid rgba(180,140,255,.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ color: '#cba8ff', fontSize: '.85rem', fontWeight: 600 }}>
          ✨ Proposition IA — relisez avant d'utiliser
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={onRegenerate} disabled={regenerating} style={miniBtn('purple')}>
            ↺ Regénérer
          </button>
          <button type="button" onClick={onReject} style={miniBtn('ghost')}>
            ✗ Ignorer
          </button>
          <button type="button" onClick={onAccept} style={miniBtn('purpleFilled')}>
            ✔ Utiliser
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.82rem' }}>
        {draft.intro_body?.length > 0 && (
          <EnrichBlock label="Intro narrative">
            {draft.intro_body.map((p, i) => (
              <p key={i} style={{ margin: '0 0 6px', color: '#e5dfd0', lineHeight: 1.5 }}>
                {p}
              </p>
            ))}
          </EnrichBlock>
        )}

        {draft.pull_quote && (
          <EnrichBlock label="Pull quote">
            <p style={{ margin: 0, color: '#e5dfd0', fontStyle: 'italic', lineHeight: 1.5 }}>
              « {draft.pull_quote} »
            </p>
          </EnrichBlock>
        )}

        {draft.tailored_points?.length > 0 && (
          <EnrichBlock label="Points clés personnalisés">
            <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#e5dfd0' }}>
              {draft.tailored_points.map((p) => (
                <li key={p.id} style={{ marginBottom: 4 }}>
                  <strong style={{ color: '#cba8ff' }}>{p.title}</strong> — {p.detail}
                </li>
              ))}
            </ul>
          </EnrichBlock>
        )}

        {draft.signature_phrase?.length > 0 && (
          <EnrichBlock label="Phrase signature (italique entre piliers et takeaways)">
            {draft.signature_phrase.map((s, i) => (
              <p key={i} style={{ margin: '0 0 4px', color: '#e5dfd0', fontStyle: 'italic' }}>
                {s}
              </p>
            ))}
          </EnrichBlock>
        )}

        {draft.section_intros && Object.keys(draft.section_intros).length > 0 && (
          <EnrichBlock label="Intros de section">
            {draft.section_intros.rotation && (
              <p style={{ margin: '0 0 4px', color: '#e5dfd0' }}>
                <strong style={{ color: '#cba8ff' }}>Rotation :</strong> {draft.section_intros.rotation}
              </p>
            )}
            {draft.section_intros.fridge && (
              <p style={{ margin: '0 0 4px', color: '#e5dfd0' }}>
                <strong style={{ color: '#cba8ff' }}>Frigo :</strong> {draft.section_intros.fridge}
              </p>
            )}
            {draft.section_intros.protocols && (
              <p style={{ margin: '0 0 4px', color: '#e5dfd0' }}>
                <strong style={{ color: '#cba8ff' }}>Compléments :</strong> {draft.section_intros.protocols}
              </p>
            )}
          </EnrichBlock>
        )}
      </div>
    </div>
  );
}

function EnrichBlock({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: '.68rem',
          fontWeight: 600,
          color: '#9d7cd8',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function miniBtn(variant) {
  const base = {
    padding: '5px 10px',
    borderRadius: 5,
    fontSize: '.74rem',
    cursor: 'pointer',
    fontWeight: 500,
  };
  if (variant === 'purpleFilled') {
    return {
      ...base,
      background: '#7d4fcf',
      border: '1px solid #7d4fcf',
      color: '#fff',
      fontWeight: 600,
    };
  }
  if (variant === 'purple') {
    return {
      ...base,
      background: 'rgba(120,80,200,.12)',
      border: '1px solid rgba(180,140,255,.25)',
      color: '#cba8ff',
    };
  }
  return {
    ...base,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,.15)',
    color: '#8a8a7a',
  };
}

// ─── Diagnostic ──────────────────────────────────────────────────────────

function DiagnosticView({ diag }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '.85rem' }}>
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: diag.ok ? 'rgba(80,160,100,.1)' : 'rgba(220,180,80,.08)',
          border: `1px solid ${diag.ok ? 'rgba(80,160,100,.3)' : 'rgba(220,180,80,.3)'}`,
          color: diag.ok ? '#b6d8b8' : '#e5c878',
        }}
      >
        {diag.ok
          ? '✓ Toutes les sections principales contiennent des données.'
          : `⚠ ${diag.issues.length} avertissement(s) — voir détails ci-dessous.`}
      </div>

      <div>
        <h4 style={{ margin: '0 0 8px', color: '#d4c9a8', fontSize: '.85rem' }}>
          Compteurs
        </h4>
        <ul style={{ margin: 0, padding: '0 0 0 18px', color: '#cfcfc4' }}>
          <li>Intro — paragraphes : {diag.summary.intro_paragraphs}</li>
          <li>Stratégie — pillars : {diag.summary.strategy_pillars}, takeaways : {diag.summary.strategy_takeaways}</li>
          <li>Semaine — total repas : {diag.summary.week_total_meals}</li>
          <li>Rotation — catégories : {diag.summary.rotation_categories}</li>
          <li>Frigo — items : {diag.summary.fridge_items}</li>
          <li>Compléments — groupes : {diag.summary.protocol_groups}</li>
        </ul>
      </div>

      {diag.issues.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', color: '#d4c9a8', fontSize: '.85rem' }}>
            Avertissements
          </h4>
          <ul style={{ margin: 0, padding: '0 0 0 18px', color: '#e5c878' }}>
            {diag.issues.map((iss, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{iss}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── V97.13.32 — Aperçu téléphone réutilisable ─────────────────────────────
//
// Mockup iPhone CSS (charte .jrn-phone-mockup* du journey.css, V97.13.15)
// adapté pour la modal Espace cliente. Pré-rempli avec les vraies données
// du plan quand disponibles (prénom, premier repas, énergie target).
// Permet à Anissa de "voir ce que voit la cliente" en un coup d'œil,
// avant de plonger dans le détail des sections à droite.

function ClientPhoneMockup({ client, plan }) {
  const prenom = (client?.prenom || client?.form?.prenom || 'Cliente').trim();

  // Pioche le premier repas du plan si dispo, sinon fallback neutre.
  const firstDay = plan?.sections?.week_meals?.days?.[0];
  const firstMeal = firstDay?.meals?.[0];
  const mealLabel = firstMeal?.slot_label || 'Petit-déjeuner';
  const mealTitle = firstMeal?.title || 'Œufs · avocat · pain complet';

  // Premier groupe de compléments si dispo (pour donner du contenu réel)
  const supplementsGroups = plan?.sections?.supplements?.groups || [];
  const firstSuppGroup = supplementsGroups[0];
  const firstSuppItem = firstSuppGroup?.items?.[0];

  return (
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

        {/* Header — avatar Anissa + greeting cliente */}
        <div className="jrn-phone-mockup__header">
          <div className="jrn-phone-mockup__avatar">A</div>
          <div className="jrn-phone-mockup__header-text">
            <div className="jrn-phone-mockup__hi">Bonjour {prenom}</div>
            <div className="jrn-phone-mockup__sub">Jour 1 · semaine 1</div>
          </div>
        </div>

        {/* Mini courbe ressentis 7j (indicative) */}
        <div className="jrn-phone-mockup__chart">
          <div className="jrn-phone-mockup__chart-head">
            <span className="jrn-phone-mockup__chart-label">Énergie · 7 jours</span>
            <span className="jrn-phone-mockup__chart-trend">+18%</span>
          </div>
          <svg className="jrn-phone-mockup__chart-svg" viewBox="0 0 200 44" preserveAspectRatio="none">
            <defs>
              <linearGradient id="jrnAppPreviewArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A2E1F" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#1A2E1F" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M5,36 Q35,32 60,26 T120,16 T195,7 L195,44 L5,44 Z" fill="url(#jrnAppPreviewArea)" />
            <path d="M5,36 Q35,32 60,26 T120,16 T195,7" stroke="#1A2E1F" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="5" cy="36" r="2.2" fill="#1A2E1F" />
            <circle cx="42" cy="30" r="2.2" fill="#1A2E1F" />
            <circle cx="80" cy="22" r="2.2" fill="#1A2E1F" />
            <circle cx="118" cy="16" r="2.2" fill="#1A2E1F" />
            <circle cx="156" cy="11" r="2.2" fill="#1A2E1F" />
            <circle cx="195" cy="7" r="3" fill="#fff" stroke="#1A2E1F" strokeWidth="2" />
          </svg>
        </div>

        {/* Card repas — pioche le vrai premier repas si dispo */}
        <div className="jrn-phone-mockup__card">
          <span className="jrn-phone-mockup__card-icon">🥑</span>
          <div className="jrn-phone-mockup__card-body">
            <div className="jrn-phone-mockup__card-label">{mealLabel}</div>
            <div className="jrn-phone-mockup__card-text">{mealTitle}</div>
          </div>
          <span className="jrn-phone-mockup__check">✓</span>
        </div>

        {/* Card complément si dispo, sinon fallback message */}
        {firstSuppItem ? (
          <div className="jrn-phone-mockup__card">
            <span className="jrn-phone-mockup__card-icon">💊</span>
            <div className="jrn-phone-mockup__card-body">
              <div className="jrn-phone-mockup__card-label">{firstSuppGroup?.timing || firstSuppGroup?.label || 'Compléments'}</div>
              <div className="jrn-phone-mockup__card-text">{firstSuppItem.name}</div>
            </div>
          </div>
        ) : (
          <div className="jrn-phone-mockup__msg">
            <div className="jrn-phone-mockup__msg-avatar">A</div>
            <div className="jrn-phone-mockup__msg-bubble">
              Comment se passe ta semaine ?
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="jrn-phone-mockup__tabbar">
          <span className="jrn-phone-mockup__tab jrn-phone-mockup__tab--active" />
          <span className="jrn-phone-mockup__tab" />
          <span className="jrn-phone-mockup__tab" />
          <span className="jrn-phone-mockup__tab" />
        </div>
      </div>
    </div>
  );
}
