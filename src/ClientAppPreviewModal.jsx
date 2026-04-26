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

import { useMemo, useState } from 'react';
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

export default function ClientAppPreviewModal({ client, consultation, onClose }) {
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

  const handlePublish = async () => {
    setPublishError(null);
    setPublishResult(null);
    setPublishing(true);
    try {
      // Si un enrichissement a été appliqué, on l'inclut dans le payload
      // de publication via le 3e arg.
      const res = await publishConsultationToClientApp(client, consultation, enrichmentApplied);
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
          maxWidth: 920,
          width: '92vw',
          maxHeight: '90vh',
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
            <h3 style={{ margin: 0, color: '#d4c9a8', fontSize: '1rem', fontWeight: 700 }}>
              📱 Aperçu app cliente
            </h3>
            <div style={{ fontSize: '.75rem', color: '#8a8a7a', marginTop: 2 }}>
              JSON résolu pour <strong>{client?.prenom || 'cliente'}</strong> — non publié, lecture seule.
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
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '.8rem',
                cursor: enriching ? 'wait' : 'pointer',
                opacity: enriching ? 0.6 : 1,
              }}
              title="Demander à l'IA un enrichissement éditorial (intro narrative, points clés, etc.)"
            >
              {enriching
                ? '✨ Génération…'
                : enrichmentApplied
                  ? '✨ Enrichi ✓'
                  : '✨ Enrichir'}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!plan}
              style={{
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.1)',
                color: '#d4c9a8',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '.8rem',
                cursor: 'pointer',
              }}
              title="Copier le JSON"
            >
              {copied ? '✓ Copié' : 'Copier JSON'}
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

        {/* Onglets */}
        <div
          role="tablist"
          aria-label="Vue"
          style={{
            display: 'flex',
            gap: 4,
            padding: '10px 22px 0',
            borderBottom: '1px solid rgba(255,255,255,.06)',
          }}
        >
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
        </div>

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

        {/* Corps */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px' }}>
          {error && (
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: 'rgba(220,80,80,.1)',
                border: '1px solid rgba(220,80,80,.3)',
                color: '#f5c6c6',
                fontSize: '.85rem',
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

        {/* Footer publication */}
        <PublishFooter
          cfgCheck={cfgCheck}
          clientEmail={clientEmail}
          plan={plan}
          publishing={publishing}
          publishResult={publishResult}
          publishError={publishError}
          confirming={confirmingPublish}
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
  onAskConfirm, onCancel, onConfirm,
}) {
  const blockedReasons = [];
  if (!plan) blockedReasons.push('Mapping en erreur');
  if (!cfgCheck.ok) blockedReasons.push('Config publication manquante');
  if (!clientEmail) blockedReasons.push('Cliente sans email');

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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
        {confirming ? (
          <>
            <span style={{ fontSize: '.78rem', color: '#cfcfc4', marginRight: 'auto' }}>
              Publier vers <strong>{clientEmail}</strong> ?
              {publishResult?.ok && ' (Ré-publication — nouvelle version, ancienne archivée.)'}
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
            <button
              type="button"
              onClick={onConfirm}
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
              {publishing ? 'Publication…' : 'Confirmer'}
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
            title={canPublish ? 'Publier vers app cliente' : blockedReasons.join(' • ')}
          >
            {publishResult?.ok ? '↻ Re-publier' : '🚀 Publier dans l\'app'}
          </button>
        )}
      </div>
    </footer>
  );
}

// ─── Aperçu sections (vue lisible) ──────────────────────────────────────

function SectionsOverview({ plan }) {
  const s = plan.sections || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: '.85rem' }}>
      <Meta plan={plan} />

      <SectionCard title="🪶 Intro" empty={!s.intro_data?.body?.length}>
        <KV label="Greeting" value={s.intro_data?.greeting} />
        <KV label="Body (paragraphes)" value={`${s.intro_data?.body?.length || 0} paragraphe(s)`} />
        <KV label="Signature" value={s.intro_data?.signature} />
        <KV label="Coach role" value={s.intro_data?.coach_role} />
        <Missing fields={[
          ['greeting_tagline', s.intro_data?.greeting_tagline],
          ['pull_quote', s.intro_data?.pull_quote],
          ['tailored_points', s.intro_data?.tailored_points?.length],
          ['eyebrow', s.intro_data?.eyebrow],
          ['coach_avatar_url', s.intro_data?.coach_avatar_url],
        ]} />
      </SectionCard>

      <SectionCard title="🧭 Stratégie" empty={!s.strategy_data?.essential?.length && !s.strategy_data?.pillars?.length}>
        <KV label="Header" value={s.strategy_data?.header_title} />
        <KV label="Essential (paragraphes)" value={`${s.strategy_data?.essential?.length || 0}`} />
        <KV label="Pillars" value={`${s.strategy_data?.pillars?.length || 0}`} />
        <KV label="Takeaways" value={`${s.strategy_data?.takeaways?.length || 0}`} />
        {s.strategy_data?.pillars?.map((p) => (
          <KV key={p.id} label={`  · ${p.id}`} value={p.title} indent />
        ))}
        <Missing fields={[
          ['signature_phrase', s.strategy_data?.signature_phrase?.length],
          ['expected_changes', s.strategy_data?.expected_changes?.length],
        ]} />
      </SectionCard>

      <SectionCard title="🍽️ Semaine 1" empty={!s.week_meals?.days?.length}>
        <KV label="Jours" value={`${s.week_meals?.days?.length || 0}`} />
        {s.week_meals?.days?.[0] && (
          <>
            <KV
              label="Repas / jour (j1)"
              value={`${s.week_meals.days[0].meals?.length || 0} repas`}
            />
            <ul style={{ margin: '4px 0 0 14px', padding: 0, listStyle: 'disc', color: '#8a8a7a' }}>
              {s.week_meals.days[0].meals?.map((m) => (
                <li key={m.id} style={{ fontSize: '.78rem' }}>
                  <strong>{m.slot_label}</strong> — {m.title}
                </li>
              ))}
            </ul>
            <Note>
              Mode "semaine type" : tous les jours sont identiques. L'override par jour
              viendra après migration DB.
            </Note>
          </>
        )}
        <Missing fields={[
          ['days[].focus', s.week_meals?.days?.some((d) => d.focus)],
          ['meals[].time', s.week_meals?.days?.[0]?.meals?.some((m) => m.time)],
          ['meals[].hint', s.week_meals?.days?.[0]?.meals?.some((m) => m.hint)],
        ]} />
      </SectionCard>

      <SectionCard title="🔄 Rotation" empty={!s.rotation_data?.categories?.length}>
        <KV label="Categories" value={`${s.rotation_data?.categories?.length || 0}`} />
        {s.rotation_data?.categories?.map((c) => (
          <KV
            key={c.id}
            label={`  · ${c.title}${c.primary ? ' ★' : ''}`}
            value={`${c.items?.length || 0} alternatives`}
            indent
          />
        ))}
        <Missing fields={[['intro', s.rotation_data?.intro]]} />
      </SectionCard>

      <SectionCard
        title="🧊 Frigo"
        empty={
          !s.fridge_data?.essentials?.length &&
          !s.fridge_data?.favorite?.length &&
          !s.fridge_data?.limit?.length
        }
      >
        <KV label="Essentials" value={`${s.fridge_data?.essentials?.length || 0} items`} />
        <KV label="Favorite" value={`${s.fridge_data?.favorite?.length || 0} catégories`} />
        <KV label="Limit" value={`${s.fridge_data?.limit?.length || 0} catégories`} />
        <Missing fields={[
          ['intro', s.fridge_data?.intro],
          ['essentials_subtitle', s.fridge_data?.essentials_subtitle],
        ]} />
      </SectionCard>

      <SectionCard title="💊 Compléments" empty={!s.protocols_data?.groups?.length}>
        <KV label="Groupes (par moment)" value={`${s.protocols_data?.groups?.length || 0}`} />
        {s.protocols_data?.groups?.map((g) => (
          <KV
            key={g.id}
            label={`  · ${g.title}`}
            value={`${g.items?.length || 0} compléments`}
            indent
          />
        ))}
        <Missing fields={[['intro', s.protocols_data?.intro]]} />
      </SectionCard>
    </div>
  );
}

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
