import { useState, useEffect, useRef } from 'react';
import { useConfirmDialog, ConfirmDialog } from './components/ConfirmDialog';
import { FORMULES, CATEGORIES } from './formSteps';
import { getNutritionConsultations, deleteClient, createCycleReview, getCycleReviews, forceSyncAllConsultations, saveClient } from './store';
import { getCurrentUser } from './supabaseClient';
import CycleReviewPanel from './CycleReviewPanel';
import ClientStatusBadge from './ClientStatusBadge';
import ClientEngagementBadge from './ClientEngagementBadge';
import ClientNewFeedbacksBadge from './ClientNewFeedbacksBadge';
import { isReturnClient, daysSinceLastConsultation } from './services/returnDiagnostic';
import { buildPackFollowupSchedule, getNextPendingStep, getPackCompletion, PACK_DEFINITIONS, canSendPackReview } from './services/packSystem';
import { getClientNutritionLocale } from './services/nutritionLocale';
import { getAllClientAlerts } from './services/clientAlerts';
import { COLORS, badgeStyle } from './services/uxColors';
import { markClientReviewed } from './services/markClientReviewed';
import { clearStatusCache } from './services/fetchClientsStatus';
import { PARTNER_IDENTITY, emailSubjectQuestionnaire, emailSubjectFollowupReview } from './services/coachIdentity';
import AnalysisPlansFollowupBlock from './AnalysisPlansFollowupBlock';

// V86.2 : prend le client entier pour pouvoir brancher FR/EN via getClientNutritionLocale.
// Cliente FR (defaut) → pre-questionnaire /questionnaire/:id (inchange).
// Cliente EN Benfitcoach (suivi/intensif + langue EN) → anamnese complete EN /anamnese/:id,
// pas de pre-questionnaire.
function SendQuestionnaireButton({ client }) {
  const locale = getClientNutritionLocale(client);
  const clientId = client.id;
  const clientEmail = client.form?.email;
  const clientPrenom = client.prenom || client.form?.prenom || '';
  const handleSend = (e) => {
    e.stopPropagation();
    let url, subject, body;
    if (locale === 'EN') {
      url = `${window.location.origin}/anamnese/${clientId}`;
      subject = emailSubjectQuestionnaire('en');
      body =
        `Hello ${clientPrenom},\n\n` +
        `Ahead of our consultation, please take 10-15 minutes to complete your personalized health assessment:\n\n` +
        `➜ ${url}\n\n` +
        `All information is strictly confidential and used only to prepare your nutrition plan.`;
    } else {
      url = `${window.location.origin}/questionnaire/${clientId}`;
      subject = emailSubjectQuestionnaire('fr');
      body =
        `Bonjour ${clientPrenom},\n\n` +
        `Avant notre consultation, merci de remplir ce court questionnaire (5 minutes) :\n\n` +
        `➜ ${url}\n\n` +
        `Ce questionnaire est strictement confidentiel.`;
    }
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(clientEmail || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };
  return (
    <button onClick={handleSend} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: '10px 16px', background: 'none', border: 'none',
      color: 'var(--text)', cursor: 'pointer', fontSize: '.85rem',
    }}>
      {locale === 'EN' ? '📩 Send health assessment' : '📩 Envoyer questionnaire'}
    </button>
  );
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

// V94.15 : panel "À faire aujourd'hui" — agregat des alertes prioritaires
// (clients sans news depuis 3 mois, bilans S4 dus, suivis 2 mois)
// Calcul a chaque montage du dashboard, pas live mais suffisant.
function TodaysTasks({ onClickClient, refreshTick }) {
  const [alerts, setAlerts] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setAlerts(getAllClientAlerts(8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  if (!alerts.length) return null;

  const dangerCount = alerts.filter(a => a.level === 'danger').length;
  const warningCount = alerts.filter(a => a.level === 'warning').length;

  return (
    <div style={{
      marginBottom: 18,
      background: 'rgba(232,160,64,.04)',
      border: '1px solid rgba(232,160,64,.2)',
      borderLeft: '3px solid #e8a040',
      borderRadius: 12,
      padding: '14px 18px',
    }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', userSelect: 'none',
          marginBottom: collapsed ? 0 : 10,
        }}
        title={collapsed ? 'Afficher les actions' : 'Masquer'}
      >
        <span style={{ fontSize: '1.1rem' }}>{'\u2728'}</span>
        <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#e9b876' }}>
          À faire aujourd&apos;hui
        </span>
        <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.5)' }}>
          {alerts.length} action{alerts.length > 1 ? 's' : ''}
          {dangerCount > 0 && ` · ${dangerCount} urgente${dangerCount > 1 ? 's' : ''}`}
          {warningCount > 0 && ` · ${warningCount} à surveiller`}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '.7rem', color: 'rgba(255,255,255,.4)',
          transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform .15s',
        }}>{'\u25be'}</span>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map((a, i) => {
            const c = COLORS[a.level] || COLORS.neutral;
            return (
              <div
                key={i}
                onClick={() => onClickClient && onClickClient(a.clientId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = c.bgStrong}
                onMouseLeave={e => e.currentTarget.style.background = c.bg}
                title={`Aller voir ${a.prenom}`}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{a.icon}</span>
                <span style={{ fontSize: '.82rem', color: 'var(--text)', flex: 1 }}>
                  {a.label}
                </span>
                <span style={badgeStyle(a.level)}>{a.level === 'danger' ? 'urgent' : a.level === 'warning' ? 'à surveiller' : 'info'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getFollowUpStatus(clientId) {
  const consultations = getNutritionConsultations(clientId);
  if (consultations.length === 0) return null;
  const lastDate = new Date(consultations[0].date);
  const now = new Date();
  const diffMs = now - lastDate;
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  if (diffMonths >= 6) return 'urgent';
  if (diffMonths >= 3) return 'recommended';
  return null;
}

function ClientCard({ client, i, onConsultation, onEditConsultation, onViewHistory, onOpen, isOwn, onRefresh, onViewReview, onReturnPlan, onSendPackReview, onMarkProgramDelivered, onUnmarkProgramDelivered }) {
  const confirmDialog = useConfirmDialog();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('loading');
  const [latestReview, setLatestReview] = useState(null);
  const [transferExpanded, setTransferExpanded] = useState(false);
  const consultations = getNutritionConsultations(client.id);
  const followUp = getFollowUpStatus(client.id);
  const lastConsultation = consultations[0];
  const isReturn = isReturnClient(client);
  const daysSince = isReturn ? daysSinceLastConsultation(client) : null;
  const [sending, setSending] = useState(false);
  const [hoveredStep, setHoveredStep] = useState(null);
  const packDef = client.packType ? PACK_DEFINITIONS[client.packType] : null;
  const isFollowupPack = !!client.packType?.startsWith('suivi');
  const nextStep = isFollowupPack ? getNextPendingStep(client) : null;
  const completion = isFollowupPack ? getPackCompletion(client) : null;
  const showSendBtn = canSendPackReview(nextStep);
  const packSteps = isFollowupPack ? buildPackFollowupSchedule(client) : [];

  // V96.27 — Etat remise programme (= packStartedAtConfirmed) + mini-modal date
  const isDelivered = isFollowupPack && client.packStartedAtConfirmed === true && Boolean(client.packStartedAt);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const totalPackDays = packDef?.durationWeeks ? packDef.durationWeeks * 7 : null;
  const daysSinceDelivery = isDelivered
    ? Math.max(0, Math.floor((Date.now() - new Date(client.packStartedAt).getTime()) / 86400000))
    : null;
  // Position en % de la bulle "today" sur la timeline (0-100)
  const todayProgressPct = isDelivered && totalPackDays
    ? Math.min(100, Math.max(0, (daysSinceDelivery / totalPackDays) * 100))
    : 0;

  useEffect(() => {
    getCycleReviews(client.id).then(reviews => {
      if (!reviews.length) { setReviewStatus('not_sent'); return; }
      const latest = reviews[0];
      setLatestReview(latest);
      setReviewStatus(latest.status);
    });
  }, [client.id]);
  const objectif = client.form?.objectif
    || (client.form?.symptomesObjectifs || []).slice(0, 2).join(', ')
    || client.form?.objectifPrincipal
    || null;

  const handleDelete = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const ok = await confirmDialog.ask({
      title: 'Supprimer ce client',
      message: 'Cette action est irréversible. Toutes les données associées seront perdues.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    deleteClient(client.id);
    onRefresh();
  };

  const handleSendReview = async (e) => {
    e.stopPropagation();
    const user = await getCurrentUser();
    const token = await createCycleReview(client.id, null, user?.id);
    if (!token) { alert('Erreur lors de la création du bilan'); return; }
    const url = `${window.location.origin}/review/${token}`;
    const prenom = client.prenom || '';
    const subject = emailSubjectFollowupReview('fr');
    const body =
      `Bonjour ${prenom},\n\n` +
      `4 semaines se sont écoulées depuis ton plan nutrition.\n` +
      `Merci de remplir ce bilan rapide (2 minutes) :\n\n` +
      `➜ ${url}\n\n` +
      `Cela m'aidera à ajuster ton plan pour la suite.`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm` +
      `&to=${encodeURIComponent(client.form?.email || '')}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
    setReviewStatus('sent');
  };

  const urgencyColor = followUp === 'urgent'
    ? '#e05252' : followUp === 'recommended'
    ? '#e09a3a' : 'transparent';

  return (
    <div
      className="anissa-client-card-mobile"
      style={{
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.08)',
        borderLeft: `3px solid ${urgencyColor === 'transparent' ? 'rgba(106,191,138,.3)' : urgencyColor}`,
        borderRadius: 14,
        padding: '16px 20px',
        minHeight: 'auto',
        cursor: isOwn && onOpen ? 'pointer' : 'default',
        transition: 'all .2s',
        position: 'relative',
        animationDelay: `${i * 50}ms`,
      }}
      onClick={isOwn && onOpen ? () => onOpen(client.id) : undefined}
    >
      {/* Zone 1 — Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'rgba(106,191,138,.15)',
        border: '1.5px solid rgba(106,191,138,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1rem', fontWeight: 700, color: '#8abf9a', flexShrink: 0,
      }}>
        {getInitial(client.prenom)}
      </div>

      {/* Zone 2 — Infos */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
        }}>
          <span style={{
            fontWeight: 700, fontSize: '1rem', color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {client.prenom || 'Sans nom'}
          </span>
          <ClientStatusBadge email={client.form?.email} stagingClientId={client.stagingClientId} />
          <ClientEngagementBadge email={client.form?.email} stagingClientId={client.stagingClientId} />
          <ClientNewFeedbacksBadge email={client.form?.email} stagingClientId={client.stagingClientId} />
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
          {consultations.length > 0
            ? `${consultations.length} consultation${consultations.length > 1 ? 's' : ''} \u00b7 derni\u00e8re ${formatDate(lastConsultation?.date)}`
            : 'Aucune consultation'}
        </div>
        {followUp && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: '.72rem', fontWeight: 600, padding: '3px 10px',
            borderRadius: 20, alignSelf: 'flex-start',
            background: followUp === 'urgent' ? 'rgba(224,82,82,.15)' : 'rgba(224,154,58,.15)',
            color: followUp === 'urgent' ? '#e05252' : '#e09a3a',
            border: `1px solid ${followUp === 'urgent' ? 'rgba(224,82,82,.3)' : 'rgba(224,154,58,.3)'}`,
          }}>
            {followUp === 'urgent' ? '\u26a0 Suivi urgent' : '\u25cb Suivi recommand\u00e9'}
          </span>
        )}
        {reviewStatus === 'submitted' && (
          <span
            onClick={e => e.stopPropagation()}
            style={{
              display:'inline-flex', alignItems:'center', gap:4,
              fontSize:'.7rem', fontWeight:600, padding:'2px 8px',
              borderRadius:20, alignSelf:'flex-start',
              background:'rgba(74,222,128,.1)',
              color:'#4ade80',
              border:'1px solid rgba(74,222,128,.2)',
              marginBottom: 4,
              cursor: 'default',
            }}>
            ✓ Bilan reçu
          </span>
        )}
        {isReturn && (
          <span style={{
            display:'inline-flex', alignItems:'center', gap:4,
            fontSize:'.7rem', fontWeight:600, padding:'2px 8px',
            borderRadius:20, alignSelf:'flex-start',
            background:'rgba(96,165,250,.1)',
            color:'#60a5fa',
            border:'1px solid rgba(96,165,250,.2)',
            marginBottom:4,
          }}>
            🔁 Reprise — {daysSince}j
          </span>
        )}
        {client.form?.referredBy === 'benoit' && (
          <>
            <span
              onClick={e => { e.stopPropagation(); if (client.form?.anissaTransferSummary) setTransferExpanded(v => !v); }}
              title={client.form?.anissaTransferSummary
                ? `Transmission ${PARTNER_IDENTITY.name} disponible — cliquer pour ${transferExpanded ? 'masquer' : 'afficher'} le résumé`
                : `Client de ${PARTNER_IDENTITY.name}`}
              style={{
                display:'inline-flex', alignItems:'center', gap:4,
                fontSize:'.7rem', fontWeight:600, padding:'2px 8px',
                borderRadius:20, alignSelf:'flex-start',
                background:'rgba(196,160,80,.12)',
                color:'#c4a050',
                border:'1px solid rgba(196,160,80,.3)',
                marginBottom:4,
                cursor: client.form?.anissaTransferSummary ? 'pointer' : 'default',
              }}
            >
              🤝 Client de {PARTNER_IDENTITY.name}
              {client.form?.anissaTransferStatus && client.form.anissaTransferStatus !== 'sent' ? ` · ${client.form.anissaTransferStatus}` : ''}
              {client.form?.anissaTransferSummary ? (transferExpanded ? ' ▴' : ' ▾') : ''}
            </span>
            {client.form?.anissaTransferSummary && !transferExpanded && (
              <span style={{
                fontSize:'.68rem', color:'rgba(196,160,80,.75)',
                fontStyle:'italic', marginTop:-2, marginBottom:4,
              }}>
                📋 Résumé transmission disponible (cliquer badge)
              </span>
            )}
            {client.form?.anissaTransferSummary && transferExpanded && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  marginTop: 2, marginBottom: 6,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(196,160,80,0.06)',
                  border: '1px solid rgba(196,160,80,0.25)',
                  whiteSpace: 'pre-wrap',
                  fontSize: '.72rem',
                  lineHeight: 1.5,
                  color: 'var(--text)',
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                {client.form.anissaTransferSummary}
                {client.form?.anissaTransferAt && (
                  <div style={{ marginTop: 6, fontSize: '.9em', color: 'var(--text-muted)' }}>
                    Transmis le {formatDate(client.form.anissaTransferAt)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {isFollowupPack && packDef && (
          <div style={{
            margin: '10px 0 4px',
            padding: '10px 12px',
            background: 'rgba(197,176,122,.06)',
            border: '1px solid rgba(197,176,122,.15)',
            borderRadius: 8,
          }}>
            {/* Header : label + compteur */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{ color: '#c5b07a', fontWeight: 600, fontSize: '.75rem' }}>
                {packDef.label}
              </span>
              {completion && (
                <span style={{ color: 'rgba(255,255,255,.3)', fontSize: '.68rem' }}>
                  {completion.done}/{completion.total} étapes
                </span>
              )}
            </div>

            {/* Progress bar */}
            {completion && completion.total > 0 && (
              <div style={{
                width: '100%',
                height: 2,
                background: 'rgba(255,255,255,.06)',
                borderRadius: 2,
                marginBottom: 10,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${completion.percent}%`,
                  background: completion.percent === 100
                    ? '#22c55e'
                    : 'linear-gradient(90deg, #22c55e, #c5b07a)',
                  borderRadius: 2,
                  transition: 'width .4s ease',
                }} />
              </div>
            )}

            {/* V96.28 — Etat "Programme à remettre" — clinique pro */}
            {isFollowupPack && !isDelivered && !showDeliveryModal && (
              <div style={{
                marginBottom: 12,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(197,176,122,.06) 0%, rgba(197,176,122,.02) 100%)',
                border: '1px solid rgba(197,176,122,.18)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'rgba(197,176,122,.12)',
                    border: '1px solid rgba(197,176,122,.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', flexShrink: 0,
                  }}>
                    {'\ud83d\udce6'}
                  </div>
                  <div>
                    <div style={{ fontSize: '.82rem', fontWeight: 600, color: '#d8c89a', marginBottom: 2, letterSpacing: '.01em' }}>
                      Programme à remettre
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.45)', lineHeight: 1.45 }}>
                      Le suivi clinique démarre dès la remise. Marquer la date pour activer la timeline.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeliveryDateInput(new Date().toISOString().slice(0, 10));
                    setShowDeliveryModal(true);
                  }}
                  style={{
                    padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(197,176,122,.4)',
                    background: 'rgba(197,176,122,.15)', color: '#e0cd96',
                    fontSize: '.76rem', fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap', letterSpacing: '.02em',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(197,176,122,.22)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(197,176,122,.15)'; }}
                >
                  Marquer comme remis
                </button>
              </div>
            )}

            {/* V96.28 — Mini-modal date remise — design clinique */}
            {showDeliveryModal && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  marginBottom: 12, padding: 16, borderRadius: 12,
                  background: 'rgba(20, 32, 22, .85)',
                  border: '1px solid rgba(197,176,122,.35)',
                  boxShadow: '0 4px 16px rgba(0,0,0,.35)',
                }}
              >
                <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#e0cd96', marginBottom: 4, letterSpacing: '.01em' }}>
                  Date de remise du programme
                </div>
                <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.45)', marginBottom: 12 }}>
                  La cliente a reçu son dossier en mains à cette date. La timeline démarre ce jour-là (J0).
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={deliveryDateInput}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDeliveryDateInput(e.target.value)}
                    style={{
                      padding: '8px 12px', borderRadius: 7, fontSize: '.85rem',
                      background: 'rgba(0,0,0,.4)', color: '#f0f0e8',
                      border: '1px solid rgba(255,255,255,.18)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const iso = new Date(deliveryDateInput + 'T00:00:00').toISOString();
                      onMarkProgramDelivered?.(client.id, iso);
                      setShowDeliveryModal(false);
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: 7, border: 'none',
                      background: '#5fbd82', color: '#0e150f',
                      fontSize: '.76rem', fontWeight: 700, cursor: 'pointer',
                      letterSpacing: '.02em',
                    }}
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeliveryModal(false)}
                    style={{
                      padding: '8px 14px', borderRadius: 7,
                      background: 'transparent', color: 'rgba(255,255,255,.55)',
                      border: '1px solid rgba(255,255,255,.12)',
                      fontSize: '.76rem', cursor: 'pointer',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* V96.28 — Timeline temporelle (jalons positionnes au % temps reel) */}
            {isDelivered && packSteps.length > 0 && totalPackDays && (() => {
              const trackHeight = 6;
              const labelLineH = 18;
              const dotSize = 11;
              const todaySize = 16;
              return (
                <div style={{ marginBottom: 10 }}>
                  {/* En-tete : chip remis + jour J */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12, gap: 12, flexWrap: 'wrap',
                  }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '5px 11px', borderRadius: 999,
                      background: 'rgba(95,189,130,.12)',
                      border: '1px solid rgba(95,189,130,.28)',
                      fontSize: '.7rem', fontWeight: 600, color: '#7fcd9b',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#5fbd82', boxShadow: '0 0 5px #5fbd82',
                      }} />
                      Programme remis le {new Date(client.packStartedAt).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                    <div style={{
                      fontSize: '.7rem', color: 'rgba(255,255,255,.45)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      Jour <span style={{ color: '#e0cd96', fontWeight: 700 }}>{daysSinceDelivery}</span>
                      <span style={{ color: 'rgba(255,255,255,.25)' }}> / {totalPackDays}</span>
                      <span style={{ color: 'rgba(255,255,255,.3)', marginLeft: 6 }}>
                        ({Math.round(todayProgressPct)}%)
                      </span>
                    </div>
                  </div>

                  {/* Track + jalons + bulle today, positionnement absolu au % temporel reel */}
                  <div style={{
                    position: 'relative',
                    height: trackHeight + dotSize + labelLineH + 8,
                    margin: '0 8px',  // marge pour eviter clipping bulle aux extremites
                  }}>
                    {/* Track de fond */}
                    <div style={{
                      position: 'absolute', top: dotSize / 2 + (todaySize - dotSize) / 2, left: 0, right: 0,
                      height: trackHeight, borderRadius: trackHeight / 2,
                      background: 'rgba(255,255,255,.05)',
                      border: '1px solid rgba(255,255,255,.04)',
                    }} />
                    {/* Track rempli (progression doree jusqu'a today) */}
                    <div style={{
                      position: 'absolute', top: dotSize / 2 + (todaySize - dotSize) / 2, left: 0,
                      width: `${todayProgressPct}%`,
                      height: trackHeight, borderRadius: trackHeight / 2,
                      background: 'linear-gradient(90deg, rgba(197,176,122,.45) 0%, rgba(224,205,150,.7) 100%)',
                      boxShadow: '0 0 8px rgba(197,176,122,.25)',
                      transition: 'width .4s ease',
                    }} />

                    {/* Jalons positionnes au % temporel reel */}
                    {packSteps.map((step) => {
                      const pct = Math.min(100, Math.max(0, (step.weekOffset / packDef.durationWeeks) * 100));
                      const isActive = nextStep?.stepNumber === step.stepNumber;
                      const isDone = step.status === 'done';
                      const isLate = step.isLate;
                      const isPast = (step.weekOffset * 7) <= daysSinceDelivery;
                      const dotColor = isDone ? '#5fbd82'
                        : isLate ? '#e57c6c'
                        : isPast ? '#e0cd96'
                        : 'rgba(255,255,255,.18)';
                      const ringColor = isActive ? 'rgba(224,205,150,.45)'
                        : isDone ? 'rgba(95,189,130,.3)'
                        : isLate ? 'rgba(229,124,108,.3)'
                        : 'rgba(255,255,255,.08)';
                      return (
                        <div
                          key={step.stepNumber}
                          onMouseEnter={() => setHoveredStep(step.stepNumber)}
                          onMouseLeave={() => setHoveredStep(null)}
                          style={{
                            position: 'absolute',
                            left: `calc(${pct}% - ${dotSize / 2}px)`,
                            top: (todaySize - dotSize) / 2,
                            width: dotSize, height: dotSize, borderRadius: '50%',
                            background: dotColor, border: `2px solid ${ringColor}`,
                            boxSizing: 'border-box',
                            cursor: 'help',
                            transition: 'all .2s',
                            zIndex: 2,
                          }}
                        >
                          {/* Label sous le jalon (S4, S8...) */}
                          <div style={{
                            position: 'absolute',
                            top: dotSize + 8, left: '50%', transform: 'translateX(-50%)',
                            fontSize: '.62rem', fontWeight: isActive ? 700 : 500,
                            color: isDone ? 'rgba(95,189,130,.85)'
                              : isLate ? '#e57c6c'
                              : isActive ? '#e0cd96'
                              : 'rgba(255,255,255,.35)',
                            letterSpacing: '.02em',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            S{step.weekOffset}
                          </div>
                          {/* Tooltip sur hover */}
                          {hoveredStep === step.stepNumber && (
                            <div style={{
                              position: 'absolute',
                              bottom: dotSize + 10, left: '50%', transform: 'translateX(-50%)',
                              minWidth: 170, padding: '8px 11px', borderRadius: 8,
                              background: 'rgba(14,21,15,.97)',
                              border: '1px solid rgba(197,176,122,.25)',
                              boxShadow: '0 4px 12px rgba(0,0,0,.4)',
                              zIndex: 30, pointerEvents: 'none',
                            }}>
                              <div style={{ fontSize: '.72rem', fontWeight: 600, color: '#e0cd96', marginBottom: 4 }}>
                                {step.label}
                              </div>
                              <div style={{
                                fontSize: '.66rem',
                                color: isDone ? '#5fbd82'
                                  : isLate ? '#e57c6c'
                                  : step.status === 'sent' ? '#e0cd96'
                                  : 'rgba(255,255,255,.5)',
                              }}>
                                {isDone ? '\u2713 Complete'
                                  : step.status === 'sent' ? '\u23f3 Envoye'
                                  : isLate ? '\u26a0 En retard'
                                  : step.isDueSoon ? '\u2192 A envoyer cette semaine'
                                  : '\u25cb A venir'}
                              </div>
                              {step.dueDate && (
                                <div style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.35)', marginTop: 3 }}>
                                  {new Date(step.dueDate).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Bulle "aujourd'hui" — design clinique soigne */}
                    <div
                      title={`Aujourd'hui — Jour ${daysSinceDelivery} sur ${totalPackDays}`}
                      style={{
                        position: 'absolute',
                        left: `calc(${todayProgressPct}% - ${todaySize / 2}px)`,
                        top: 0,
                        width: todaySize, height: todaySize, borderRadius: '50%',
                        background: '#e0cd96',
                        border: '3px solid rgba(14,21,15,1)',
                        boxShadow: '0 0 0 2px rgba(197,176,122,.35), 0 0 12px rgba(197,176,122,.5)',
                        zIndex: 4,
                        transition: 'left .4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Prochaine étape texte */}
            {nextStep && (
              <div style={{
                fontSize: '.7rem',
                color: nextStep.isLate ? '#f87171'
                     : nextStep.isDueSoon ? '#fbbf24'
                     : 'rgba(255,255,255,.5)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 2,
              }}>
                <span>{nextStep.isLate ? '⚠️' : '→'}</span>
                {nextStep.type === 'review' && !nextStep.isLate
                  ? `${nextStep.label} à envoyer`
                  : nextStep.isLate
                  ? `${nextStep.label} — en retard`
                  : nextStep.label}
              </div>
            )}
          </div>
        )}
        {objectif && (
          <div style={{ fontSize: '.8rem', color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {objectif}
          </div>
        )}
      </div>

      {/* Zone 3 — Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {/* V94.23 : bouton CTA contextuel selon next pack step.
            - Si etape proche (< 7j) ou en retard : bouton specifique 'Bilan S4'
              avec couleur d urgence (rouge si retard, ambre si du, vert si proche)
            - Sinon : '+ Nouvelle consultation' standard */}
        {(() => {
          const next = isFollowupPack ? nextStep : null;
          const dueDate = next ? new Date(next.dueDate) : null;
          const daysUntilDue = dueDate ? Math.floor((dueDate.getTime() - Date.now()) / 86400000) : null;
          const isLate = next?.isLate;
          const isImminent = !isLate && daysUntilDue !== null && daysUntilDue <= 7;

          if (next && (isLate || isImminent)) {
            // Bouton contextuel pour l etape proche/en retard
            const shortLabel = next.label.replace(/^Bilan\s+/, '').replace(/\s+—.*$/, '');
            const urgencyText = isLate
              ? `EN RETARD ${Math.abs(daysUntilDue)}j`
              : daysUntilDue === 0
                ? 'aujourd\u2019hui'
                : `dans ${daysUntilDue}j`;
            const bgColor = isLate
              ? 'rgba(212,92,76,.15)'
              : daysUntilDue <= 3
                ? 'rgba(232,160,64,.15)'
                : 'rgba(106,191,138,.15)';
            const borderColor = isLate
              ? 'rgba(212,92,76,.5)'
              : daysUntilDue <= 3
                ? 'rgba(232,160,64,.5)'
                : 'rgba(106,191,138,.5)';
            const textColor = isLate ? '#e09c8e' : daysUntilDue <= 3 ? '#e9b876' : '#8abf9a';

            return (
              <button
                className="btn btn-sm"
                style={{
                  width: 'auto', padding: '8px 16px', whiteSpace: 'nowrap',
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  color: textColor,
                  fontWeight: 600, fontSize: '.78rem',
                  borderRadius: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
                onClick={(e) => { e.stopPropagation(); onConsultation(client.id); }}
                title={`Cree la consultation ${next.label}`}
              >
                <span>{isLate ? '\u23f0' : '\ud83d\udcc5'}</span>
                <span>+ {shortLabel}</span>
                <span style={{
                  fontSize: '.7rem', opacity: .85, fontWeight: 500,
                  background: 'rgba(0,0,0,.2)', padding: '2px 8px', borderRadius: 999,
                }}>{urgencyText}</span>
              </button>
            );
          }

          // Bouton standard
          return (
            <button
              className="btn btn-sm btn-anissa-primary"
              style={{ width: 'auto', padding: '8px 18px', whiteSpace: 'nowrap' }}
              onClick={(e) => { e.stopPropagation(); onConsultation(client.id); }}
            >
              + Nouvelle consultation
            </button>
          );
        })()}
        <div style={{ position: 'relative' }}>
          {/* V94.13 : bouton menu actions plus explicite (bordure + label + chevron)
              Anissa ne voyait pas la croix 3-points isolee, on lui donne un vrai
              bouton 'Plus' avec chevron qui rotates a l'ouverture. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
            title="Plus d'actions (historique, modifier, supprimer...)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.18)',
              borderRadius: 8,
              padding: '7px 12px',
              cursor: 'pointer',
              color: 'var(--text)',
              fontSize: '.78rem',
              fontWeight: 500,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              transition: 'background .15s, border-color .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(106,191,138,.1)';
              e.currentTarget.style.borderColor = 'rgba(106,191,138,.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,.04)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)';
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{'\u22ef'}</span>
            <span>Plus</span>
            <span style={{
              fontSize: '.65rem',
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform .15s',
              opacity: .7,
            }}>{'\u25be'}</span>
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 50,
              background: '#1e241f', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 10, overflow: 'hidden', minWidth: 180,
              boxShadow: '0 8px 24px rgba(0,0,0,.4)', marginTop: 4,
            }}>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onViewHistory(client.id); }}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 16px',
                  background:'none', border:'none', color:'var(--text)', cursor:'pointer',
                  fontSize:'.85rem' }}>
                {'\ud83d\udccb'} Voir l'historique
              </button>
              {/* V86.5 : bouton Modifier l'anamnese disponible pour tous les clients
                  (own ET shared). Pour les shared, onOpen pointe aussi vers anissaEditClient. */}
              {onOpen && (
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpen(client.id); }}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 16px',
                    background:'none', border:'none', color:'var(--text)', cursor:'pointer',
                    fontSize:'.85rem' }}>
                  {'\u270f\ufe0f'} Modifier l'anamn{'\u00e8'}se
                </button>
              )}
              <SendQuestionnaireButton client={client} />
              {/* V94.60 : raccourci direct vers l'onglet 'App cliente' de la
                  consultation. Set un flag localStorage que NutritionConsultation
                  lit au mount pour ouvrir direct sur le hub App cliente.
                  V96.8 (fix) : ouvre la derniere consultation existante via
                  onEditConsultation (au lieu de demarrer une nouvelle conso vide
                  via onConsultation). Bouton desactive si pas de consultation. */}
              {(() => {
                const lastConsultation = consultations[0] || null;
                const disabled = !lastConsultation || !onEditConsultation;
                return (
                  <button
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (disabled) return;
                      setMenuOpen(false);
                      try { localStorage.setItem('bfc_open_consultation_tab', 'app'); } catch { /* */ }
                      onEditConsultation(lastConsultation);
                    }}
                    title={disabled ? 'Aucune consultation existante — cree une consultation d\'abord' : ''}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', background: 'none', border: 'none',
                      color: disabled ? 'rgba(130,195,158,.35)' : '#82c39e',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: '.85rem',
                      opacity: disabled ? 0.5 : 1,
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(130,195,158,.08)'; }}
                    onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'none'; }}
                  >
                    📱 Espace app cliente
                  </button>
                );
              })()}

              {/* V96.27 — Actions sur le marquage de remise programme (pack suivi uniquement) */}
              {isFollowupPack && isDelivered && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      setDeliveryDateInput(client.packStartedAt
                        ? new Date(client.packStartedAt).toISOString().slice(0, 10)
                        : new Date().toISOString().slice(0, 10));
                      setShowDeliveryModal(true);
                    }}
                    style={{
                      display:'block', width:'100%', textAlign:'left', padding:'10px 16px',
                      background:'none', border:'none', color:'#e8a040', cursor:'pointer',
                      fontSize:'.85rem',
                    }}
                  >
                    {'\ud83d\udcc5'} Modifier la date de remise
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirmDialog.ask({
                        title: 'Annuler la remise ?',
                        message: 'La timeline du suivi sera mise en pause jusqu\'à un nouveau marquage.',
                        confirmLabel: 'Annuler la remise',
                        danger: true,
                      });
                      if (!ok) return;
                      setMenuOpen(false);
                      onUnmarkProgramDelivered?.(client.id);
                    }}
                    style={{
                      display:'block', width:'100%', textAlign:'left', padding:'10px 16px',
                      background:'none', border:'none', color:'rgba(255,255,255,.55)', cursor:'pointer',
                      fontSize:'.85rem',
                    }}
                  >
                    {'\u21ba'} Annuler la remise
                  </button>
                </>
              )}

              {/* Séparateur */}
              <div style={{ height:1, background:'rgba(255,255,255,.06)', margin:'4px 0' }} />

              {/* Plan de reprise */}
              {isReturn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onReturnPlan(client);
                  }}
                  style={{
                    display:'block', width:'100%', textAlign:'left',
                    padding:'10px 16px', background:'none', border:'none',
                    color:'#60a5fa', cursor:'pointer', fontSize:'.85rem',
                    transition:'background .15s',
                    borderBottom:'1px solid rgba(255,255,255,.06)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(96,165,250,.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}
                >
                  🔁 Générer plan de reprise
                </button>
              )}

              {/* Badge statut bilan */}
              {reviewStatus === 'submitted' && latestReview && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onViewReview(latestReview, client);
                  }}
                  style={{
                    display:'block', width:'100%', textAlign:'left',
                    padding:'10px 16px', background:'none', border:'none',
                    color:'#4ade80', cursor:'pointer', fontSize:'.85rem',
                    transition:'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(74,222,128,.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}
                >
                  🟢 Bilan reçu — Voir le détail
                </button>
              )}
              {reviewStatus === 'sent' && (
                <div style={{ padding:'8px 14px', fontSize:'.78rem',
                  color:'#fbbf24', display:'flex', alignItems:'center', gap:6 }}>
                  🟡 Bilan en attente
                </div>
              )}
              {(reviewStatus === 'not_sent' || reviewStatus === 'loading') && (
                <button
                  onClick={handleSendReview}
                  style={{
                    display:'block', width:'100%', textAlign:'left',
                    padding:'10px 16px', background:'none', border:'none',
                    color:'var(--text)', cursor:'pointer', fontSize:'.85rem',
                    transition:'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(106,191,138,.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}
                >
                  📋 Envoyer bilan 4 semaines
                </button>
              )}

              {isOwn && showSendBtn && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (sending) return;
                    setMenuOpen(false);
                    setSending(true);
                    try {
                      await onSendPackReview?.(client, nextStep);
                    } finally {
                      setSending(false);
                    }
                  }}
                  disabled={sending}
                  style={{
                    display:'block', width:'100%', textAlign:'left',
                    padding:'10px 16px', background:'none', border:'none',
                    color: sending ? 'rgba(197,176,122,.4)' : '#c5b07a',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    fontSize:'.85rem', transition:'background .15s',
                  }}
                  onMouseEnter={e => { if (!sending) e.currentTarget.style.background='rgba(197,176,122,.08)'; }}
                  onMouseLeave={e => e.currentTarget.style.background='none'}
                >
                  {sending ? '⏳ Envoi...' : '📋 Envoyer le bilan'}
                </button>
              )}

              {isOwn && (
                <button onClick={handleDelete}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 16px',
                    background:'none', border:'none', color:'#e05252', cursor:'pointer',
                    fontSize:'.85rem', borderTop:'1px solid rgba(255,255,255,.06)' }}>
                  {'\ud83d\uddd1'} Supprimer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />
    </div>
  );
}

export default function AnissaDashboard({ sharedClients, ownClients, onConsultation, onEditConsultation, onViewHistory, onNewClient, onOpenClient, onRefresh, onAdaptPlan, onReturnPlan, onSendPackReview, onMarkProgramDelivered, onUnmarkProgramDelivered }) {
  const [search, setSearch] = useState('');
  // V94.16 : filtre rapide par statut client (all / active / hors_app / recontact)
  const [statusFilter, setStatusFilter] = useState('all');
  // V97.11 : tri ('alert' = priorite urgence, 'recent' = derniere conso, 'name' = alphabetique)
  const [sortBy, setSortBy] = useState('alert');
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedReviewClient, setSelectedReviewClient] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  // V97.11 — bouton "Tout marquer lu" (batch)
  const [markingAll, setMarkingAll] = useState(false);
  const [markAllResult, setMarkAllResult] = useState(null);

  // V97.11 — Ctrl+K (ou Cmd+K macOS) → focus la barre de recherche
  const searchInputRef = useRef(null);
  useEffect(() => {
    const handleKeydown = (e) => {
      // Ctrl+K (Win/Linux) ou Cmd+K (macOS)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  // V97.11 — detection plateforme pour afficher le bon raccourci visuel
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  const allClients = [...sharedClients, ...ownClients];

  // Clients needing follow-up (last consultation > 3 months)
  const clientsToRecontact = allClients.filter(c => {
    const status = getFollowUpStatus(c.id);
    return status === 'recommended' || status === 'urgent';
  });

  let filteredShared = sharedClients;
  let filteredOwn = ownClients;
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filteredShared = sharedClients.filter(c => (c.prenom || '').toLowerCase().includes(q));
    filteredOwn = ownClients.filter(c => (c.prenom || '').toLowerCase().includes(q));
  }

  // V94.16 : filtre par statut (active = a au moins 1 conso, hors_app = aucune,
  // recontact = clientsToRecontact contient cet id)
  if (statusFilter !== 'all') {
    const recontactIds = new Set(clientsToRecontact.map(c => c.id));
    const passes = (c) => {
      const consCount = getNutritionConsultations(c.id).length;
      if (statusFilter === 'active') return consCount > 0;
      if (statusFilter === 'hors_app') return consCount === 0;
      if (statusFilter === 'recontact') return recontactIds.has(c.id);
      return true;
    };
    filteredShared = filteredShared.filter(passes);
    filteredOwn = filteredOwn.filter(passes);
  }

  // V97.11 — Tri des clientes selon sortBy
  // - 'alert'  : urgent (>6 mois) > recommended (>3 mois) > sans conso > normal,
  //              tie-break par derniere conso desc
  // - 'recent' : derniere conso desc (plus recent en haut)
  // - 'name'   : alphabetique prenom asc
  const sortClients = (clients) => {
    const enriched = clients.map((c) => {
      const consultations = getNutritionConsultations(c.id);
      const lastDate = consultations[0] ? new Date(consultations[0].date).getTime() : 0;
      const followUp = getFollowUpStatus(c.id); // 'urgent' | 'recommended' | null
      let alertScore = 0;
      if (followUp === 'urgent') alertScore = 100;
      else if (followUp === 'recommended') alertScore = 50;
      else if (consultations.length === 0) alertScore = 25; // hors_app
      return { client: c, lastDate, alertScore };
    });
    if (sortBy === 'alert') {
      enriched.sort((a, b) => b.alertScore - a.alertScore || b.lastDate - a.lastDate);
    } else if (sortBy === 'recent') {
      enriched.sort((a, b) => b.lastDate - a.lastDate);
    } else if (sortBy === 'name') {
      enriched.sort((a, b) => (a.client.prenom || '').localeCompare(b.client.prenom || '', 'fr'));
    }
    return enriched.map((e) => e.client);
  };
  filteredShared = sortClients(filteredShared);
  filteredOwn = sortClients(filteredOwn);

  // V94.16 : compteurs pour les pills
  const allClientsCount = ownClients.length + sharedClients.length;
  const activeCount = [...ownClients, ...sharedClients].filter(c => getNutritionConsultations(c.id).length > 0).length;
  const horsAppCount = allClientsCount - activeCount;
  const recontactCount = clientsToRecontact.length;

  const totalFiltered = filteredShared.length + filteredOwn.length;

  // Stats
  const now = new Date();
  const consultationsThisMonth = allClients.reduce((sum, c) => {
    return sum + getNutritionConsultations(c.id).filter(n => {
      const d = new Date(n.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, 0);

  return (
    <div className="dashboard anissa-dashboard">
      <style>{`
        @keyframes packDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: .85; }
        }
        .pack-dot-active {
          animation: packDotPulse 2.2s ease-in-out infinite;
        }
        .pack-step-tooltip {
          display: block;
        }
        @media (max-width: 768px) {
          .pack-step-tooltip {
            display: none !important;
          }
        }
      `}</style>
      {/* Stats */}
      <div className="stats-row stats-row-4">
        <div className="stat-card anissa-stat">
          <span className="stat-number">{ownClients.length}</span>
          <span className="stat-label">Mes clients</span>
        </div>
        <div className="stat-card anissa-stat">
          <span className="stat-number">{sharedClients.length}</span>
          <span className="stat-label">Clients partages</span>
        </div>
        <div className="stat-card anissa-stat">
          <span className="stat-number">{consultationsThisMonth}</span>
          <span className="stat-label">Consultations ce mois</span>
        </div>
        <div className="stat-card anissa-stat" style={clientsToRecontact.length > 0 ? {
          borderTop: '2px solid #e09a3a',
          background: 'rgba(224,154,58,.06)',
        } : {}}>
          <span className="stat-number" style={clientsToRecontact.length > 0 ? { color: '#e09a3a' } : {}}>
            {clientsToRecontact.length}
          </span>
          <span className="stat-label">A recontacter</span>
        </div>
      </div>

      {/* V94.15 : À faire aujourd'hui — alerts prioritaires inter-clients */}
      <TodaysTasks
        onClickClient={onOpenClient}
        refreshTick={ownClients.length + sharedClients.length}
      />

      {/* Phase C (2026-05-10) : compteur agrege des plans d'analyses par statut */}
      <AnalysisPlansFollowupBlock />

      <div className="dashboard-header">
        <h2>Mes clients</h2>
        {/* V97.11 — batch "Tout marquer lu" : evite a Anissa de cliquer sur
            chaque cliente pour reset le badge "X nouveaux feedbacks". Le
            helper markClientReviewed a son cache 5 min donc safe d'appeler
            sur toutes les clientes (no-op si deja marque recemment). */}
        <button
          onClick={async () => {
            setMarkingAll(true);
            setMarkAllResult(null);
            const allTargets = [...ownClients, ...sharedClients];
            const results = await Promise.allSettled(
              allTargets.map((c) => markClientReviewed(c))
            );
            const marked = results.filter(
              (r) => r.status === 'fulfilled' && r.value?.ok && r.value?.marked
            ).length;
            clearStatusCache();
            setMarkingAll(false);
            setMarkAllResult(marked);
            setTimeout(() => setMarkAllResult(null), 3000);
            if (typeof onRefresh === 'function') onRefresh();
          }}
          disabled={markingAll || (ownClients.length + sharedClients.length) === 0}
          title="Marque toutes les clientes comme vues (réinitialise les badges 'nouveaux feedbacks')"
          style={{
            marginLeft: 'auto', padding: '8px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,.1)', background: 'none',
            color: markingAll ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.5)',
            cursor: markingAll ? 'not-allowed' : 'pointer',
            fontSize: '.75rem', marginRight: 8, minHeight: 36,
          }}
        >
          {markingAll
            ? 'Marquage...'
            : markAllResult !== null
              ? `${markAllResult} marquée${markAllResult > 1 ? 's' : ''}`
              : 'Tout marquer lu'}
        </button>
        <button
          onClick={async () => {
            setSyncing(true);
            setSyncResult(null);
            const res = await forceSyncAllConsultations();
            setSyncing(false);
            setSyncResult(res);
            setTimeout(() => setSyncResult(null), 3000);
          }}
          disabled={syncing}
          style={{
            padding:'8px 12px', borderRadius:8,
            border:'1px solid rgba(255,255,255,.1)', background:'none',
            color: syncing ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.5)',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize:'.75rem', marginRight:8, minHeight:36,
          }}
        >
          {syncing ? 'Sync...' : syncResult ? `${syncResult.synced} synced` : 'Sync cloud'}
        </button>
        <button className="btn btn-sm btn-anissa-primary" onClick={onNewClient}>
          + Nouveau client
        </button>
      </div>

      <div className="search-bar" style={{ position: 'relative' }}>
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par prénom..."
          className="search-input"
          style={{ paddingRight: 56 }}
        />
        {/* V97.11 — indicateur raccourci clavier (decouvrabilite) */}
        <kbd
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '.7rem',
            fontFamily: 'inherit',
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,.12)',
            background: 'rgba(255,255,255,.04)',
            color: 'rgba(255,255,255,.45)',
            pointerEvents: 'none',
            letterSpacing: '.02em',
          }}
        >
          {shortcutLabel}
        </kbd>
      </div>

      {/* V94.16 : pills de filtre rapide par statut + V97.11 : tri */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, marginTop: -4 }}>
        {[
          { id: 'all', label: 'Tous', count: allClientsCount, color: 'rgba(255,255,255,.18)' },
          { id: 'active', label: 'Active', count: activeCount, color: 'rgba(106,191,138,.4)' },
          { id: 'hors_app', label: 'Hors app', count: horsAppCount, color: 'rgba(255,255,255,.25)' },
          { id: 'recontact', label: 'À recontacter', count: recontactCount, color: 'rgba(232,160,64,.5)' },
        ].map(p => {
          const active = statusFilter === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setStatusFilter(p.id)}
              title={`Filtrer : ${p.label}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999,
                border: `1px solid ${active ? p.color : 'rgba(255,255,255,.1)'}`,
                background: active ? `${p.color.replace('.4)', '.1)').replace('.5)', '.12)').replace('.25)', '.06)').replace('.18)', '.05)')}` : 'transparent',
                color: active ? 'var(--text)' : 'rgba(255,255,255,.55)',
                fontSize: '.78rem', fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <span>{p.label}</span>
              <span style={{
                fontSize: '.7rem',
                background: 'rgba(0,0,0,.25)',
                padding: '1px 8px', borderRadius: 999,
                color: 'rgba(255,255,255,.6)',
              }}>{p.count}</span>
            </button>
          );
        })}

        {/* V97.11 — Dropdown tri (push a droite) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.4)' }}>Tri</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(255,255,255,.03)',
              color: 'rgba(255,255,255,.7)',
              fontSize: '.78rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="alert">Alertes en premier</option>
            <option value="recent">Consultation récente</option>
            <option value="name">Alphabétique</option>
          </select>
        </div>
      </div>

      {/* Clients to re-contact alert */}
      {clientsToRecontact.length > 0 && !search.trim() && (
        <div className="recontact-section">
          <h3 className="anissa-section-title recontact-title">
            Clients a recontacter
            <span className="anissa-section-count recontact-count">{clientsToRecontact.length}</span>
          </h3>
          <div className="recontact-list">
            {clientsToRecontact.map(c => {
              const status = getFollowUpStatus(c.id);
              const consultations = getNutritionConsultations(c.id);
              const lastDate = consultations[0]?.date;
              return (
                <div key={c.id} className={`recontact-item recontact-${status}`}>
                  <span className="recontact-name">{c.prenom || 'Sans nom'}</span>
                  <span className="recontact-date">Derniere consultation : {formatDate(lastDate)}</span>
                  <span className={`recontact-badge recontact-badge-${status}`}>
                    {status === 'urgent' ? 'Suivi urgent' : 'Suivi recommande'}
                  </span>
                  <button className="btn btn-xs btn-anissa-primary" onClick={() => onConsultation(c.id)}>
                    + Consultation
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allClients.length === 0 ? (
        <div className="dashboard-empty">
          <div className="empty-title">Aucun client</div>
          <p>Crée ta première cliente ou attends que {PARTNER_IDENTITY.name} ajoute une cliente en Suivi Complet / Intensif.</p>
          <button className="btn btn-anissa-primary" onClick={onNewClient} style={{ marginTop: 16, padding: '12px 28px' }}>
            + Nouveau client
          </button>
        </div>
      ) : (
        <>
          {/* V87.6 : section OWN Anissa en premier, avec titre explicite.
              Avant : pas de titre sur own, partages en premier. Les deux se
              melangeaient visuellement car 'Mes clients' etait le seul titre
              visible et englobait tout. */}
          {filteredOwn.length > 0 && (
            <div className="anissa-section">
              <h3 className="anissa-section-title">
                Clients Anissa
                <span className="anissa-section-count">{filteredOwn.length}</span>
              </h3>
              <div className="anissa-client-list">
                {filteredOwn.map((client, i) => (
                  <ClientCard key={client.id} client={client} i={i} onConsultation={onConsultation} onEditConsultation={onEditConsultation} onViewHistory={onViewHistory} onOpen={onOpenClient} isOwn={true} onRefresh={onRefresh} onViewReview={(review, c) => { setSelectedReview(review); setSelectedReviewClient(c); }} onReturnPlan={(c) => { if (onReturnPlan) onReturnPlan(c); }} onSendPackReview={onSendPackReview} onMarkProgramDelivered={onMarkProgramDelivered} onUnmarkProgramDelivered={onUnmarkProgramDelivered} />
                ))}
              </div>
            </div>
          )}

          {/* Shared clients section \u2014 maintenant APRES own et clairement separee */}
          {filteredShared.length > 0 && (
            <div className="anissa-section" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <h3 className="anissa-section-title">
                Clients partagés avec {PARTNER_IDENTITY.name}
                <span className="anissa-section-count">{filteredShared.length}</span>
              </h3>
              <div className="anissa-client-list">
                {filteredShared.map((client, i) => (
                  <ClientCard key={client.id} client={client} i={i} onConsultation={onConsultation} onViewHistory={onViewHistory} onOpen={onOpenClient} isOwn={false} onRefresh={onRefresh} onViewReview={(review, c) => { setSelectedReview(review); setSelectedReviewClient(c); }} onReturnPlan={(c) => { if (onReturnPlan) onReturnPlan(c); }} onSendPackReview={onSendPackReview} onMarkProgramDelivered={onMarkProgramDelivered} onUnmarkProgramDelivered={onUnmarkProgramDelivered} />
                ))}
              </div>
            </div>
          )}

          {filteredShared.length === 0 && filteredOwn.length === 0 && (
            <div className="dashboard-empty">
              <p>Aucun client ne correspond a la recherche.</p>
            </div>
          )}
        </>
      )}

      {selectedReview && (
        <CycleReviewPanel
          review={selectedReview}
          client={selectedReviewClient}
          onClose={() => { setSelectedReview(null); setSelectedReviewClient(null); }}
          onOpenConsultation={onConsultation}
          onAdaptPlan={(adaptedPlan) => {
            if (onAdaptPlan) onAdaptPlan(selectedReviewClient, adaptedPlan);
            setSelectedReview(null);
            setSelectedReviewClient(null);
          }}
        />
      )}
    </div>
  );
}
