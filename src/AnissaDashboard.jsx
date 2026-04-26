import { useState, useEffect } from 'react';
import { FORMULES, CATEGORIES } from './formSteps';
import { getNutritionConsultations, deleteClient, createCycleReview, getCycleReviews, forceSyncAllConsultations, saveClient } from './store';
import { getCurrentUser } from './supabaseClient';
import CycleReviewPanel from './CycleReviewPanel';
import ClientStatusBadge from './ClientStatusBadge';
import { isReturnClient, daysSinceLastConsultation } from './services/returnDiagnostic';
import { buildPackFollowupSchedule, getNextPendingStep, getPackCompletion, PACK_DEFINITIONS, canSendPackReview } from './services/packSystem';
import { getClientNutritionLocale } from './services/nutritionLocale';

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
      subject = 'Your pre-consultation health assessment — Anissa Deroubaix';
      body =
        `Hello ${clientPrenom},\n\n` +
        `Ahead of our consultation, please take 10-15 minutes to complete your personalized health assessment:\n\n` +
        `➜ ${url}\n\n` +
        `All information is strictly confidential and used only to prepare your nutrition plan.`;
    } else {
      url = `${window.location.origin}/questionnaire/${clientId}`;
      subject = 'Votre questionnaire pre-consultation — Anissa Deroubaix';
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

function ClientCard({ client, i, onConsultation, onViewHistory, onOpen, isOwn, onRefresh, onViewReview, onReturnPlan, onSendPackReview }) {
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

  const handleDelete = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (confirm('Supprimer ce client ?')) {
      deleteClient(client.id);
      onRefresh();
    }
  };

  const handleSendReview = async (e) => {
    e.stopPropagation();
    const user = await getCurrentUser();
    const token = await createCycleReview(client.id, null, user?.id);
    if (!token) { alert('Erreur lors de la création du bilan'); return; }
    const url = `${window.location.origin}/review/${token}`;
    const prenom = client.prenom || '';
    const subject = 'Ton bilan 4 semaines — Anissa Deroubaix';
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
          <ClientStatusBadge email={client.form?.email} />
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
                ? `Transmission Benoit disponible — cliquer pour ${transferExpanded ? 'masquer' : 'afficher'} le résumé`
                : 'Client de Benoit'}
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
              🤝 Client de Benoit
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

            {/* Timeline horizontale */}
            {packSteps.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {/* Ligne avec points */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  marginBottom: 5,
                }}>
                  {packSteps.map((step, idx) => {
                    const isActive = nextStep?.stepNumber === step.stepNumber;
                    const isDone = step.status === 'done';
                    const isLate = step.isLate;
                    const dotColor = isDone ? '#22c55e'
                      : isLate ? '#f87171'
                      : isActive ? '#c5b07a'
                      : 'rgba(255,255,255,.15)';
                    const dotSize = isActive ? 12 : 8;
                    return (
                      <div
                        key={step.stepNumber}
                        style={{
                          display: 'flex', alignItems: 'center',
                          flex: idx < packSteps.length - 1 ? 1 : 'none',
                          position: 'relative',
                        }}
                        onMouseEnter={() => setHoveredStep(step.stepNumber)}
                        onMouseLeave={() => setHoveredStep(null)}
                      >
                        {hoveredStep === step.stepNumber && (
                          <div
                            className="pack-step-tooltip"
                            style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: idx === packSteps.length - 1 ? 'auto' : '50%',
                              right: idx === packSteps.length - 1 ? 0 : 'auto',
                              transform: idx === 0 ? 'translateX(0)'
                                : idx === packSteps.length - 1 ? 'translateX(0)'
                                : 'translateX(-50%)',
                              marginBottom: 8,
                              background: 'rgba(20,32,22,.97)',
                              border: '1px solid rgba(197,176,122,.2)',
                              borderRadius: 8,
                              padding: '7px 10px',
                              whiteSpace: 'nowrap',
                              zIndex: 10,
                              pointerEvents: 'none',
                              minWidth: 160,
                            }}
                          >
                            <div style={{
                              fontSize: '.72rem', fontWeight: 600,
                              color: '#c5b07a', marginBottom: 3,
                            }}>
                              {step.label}
                            </div>
                            <div style={{
                              fontSize: '.68rem',
                              color: step.status === 'done' ? '#22c55e'
                                : step.isLate ? '#f87171'
                                : step.status === 'sent' ? '#fbbf24'
                                : 'rgba(255,255,255,.4)',
                            }}>
                              {step.status === 'done' ? '✓ Complété'
                                : step.status === 'sent' ? '⏳ Envoyé'
                                : step.isLate ? '⚠️ En retard'
                                : step.isDueSoon ? '→ À envoyer cette semaine'
                                : '○ À venir'}
                            </div>
                            {step.dueDate && step.status !== 'done' && (
                              <div style={{
                                fontSize: '.65rem',
                                color: 'rgba(255,255,255,.25)',
                                marginTop: 3,
                              }}>
                                {new Date(step.dueDate).toLocaleDateString('fr-CH', {
                                  day: 'numeric', month: 'short'
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className={isActive ? 'pack-dot-active' : undefined}
                          style={{
                          width: dotSize, height: dotSize,
                          borderRadius: '50%', background: dotColor,
                          border: isActive
                            ? '2px solid rgba(197,176,122,.4)'
                            : isDone
                            ? '2px solid rgba(34,197,94,.3)'
                            : '2px solid rgba(255,255,255,.1)',
                          flexShrink: 0, transition: 'all .2s',
                          boxShadow: isActive ? '0 0 6px rgba(197,176,122,.6)' : 'none',
                          boxSizing: 'border-box',
                        }} />
                        {idx < packSteps.length - 1 && (
                          <div style={{
                            flex: 1, height: 1.5,
                            background: isDone
                              ? 'rgba(34,197,94,.4)'
                              : 'rgba(255,255,255,.08)',
                            margin: '0 2px',
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Labels S4, S8... */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  {packSteps.map((step, idx) => {
                    const isActive = nextStep?.stepNumber === step.stepNumber;
                    const isDone = step.status === 'done';
                    const isLate = step.isLate;
                    const labelColor = isDone ? 'rgba(34,197,94,.7)'
                      : isLate ? '#f87171'
                      : isActive ? '#c5b07a'
                      : 'rgba(255,255,255,.2)';
                    return (
                      <div key={step.stepNumber} style={{
                        fontSize: '.62rem', color: labelColor,
                        fontWeight: isActive ? 700 : 400,
                        textAlign: idx === 0 ? 'left'
                          : idx === packSteps.length - 1 ? 'right'
                          : 'center',
                        whiteSpace: 'nowrap',
                      }}>
                        S{step.weekOffset}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
        <button
          className="btn btn-sm btn-anissa-primary"
          style={{ width: 'auto', padding: '8px 18px', whiteSpace: 'nowrap' }}
          onClick={(e) => { e.stopPropagation(); onConsultation(client.id); }}
        >
          + Nouvelle consultation
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '1.2rem', padding: '4px 8px',
              borderRadius: 6, lineHeight: 1,
            }}
          >{'\u22ee'}</button>
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
    </div>
  );
}

export default function AnissaDashboard({ sharedClients, ownClients, onConsultation, onViewHistory, onNewClient, onOpenClient, onRefresh, onAdaptPlan, onReturnPlan, onSendPackReview }) {
  const [search, setSearch] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedReviewClient, setSelectedReviewClient] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    const close = () => {};
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

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

      <div className="dashboard-header">
        <h2>Mes clients</h2>
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
            marginLeft:'auto', padding:'8px 12px', borderRadius:8,
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

      <div className="search-bar">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par prenom..."
          className="search-input"
        />
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
          <p>Creez votre premier client ou attendez que Benoit ajoute un client en Suivi Complet / Intensif.</p>
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
                  <ClientCard key={client.id} client={client} i={i} onConsultation={onConsultation} onViewHistory={onViewHistory} onOpen={onOpenClient} isOwn={true} onRefresh={onRefresh} onViewReview={(review, c) => { setSelectedReview(review); setSelectedReviewClient(c); }} onReturnPlan={(c) => { if (onReturnPlan) onReturnPlan(c); }} onSendPackReview={onSendPackReview} />
                ))}
              </div>
            </div>
          )}

          {/* Shared clients section \u2014 maintenant APRES own et clairement separee */}
          {filteredShared.length > 0 && (
            <div className="anissa-section" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <h3 className="anissa-section-title">
                Clients partages avec Benoit
                <span className="anissa-section-count">{filteredShared.length}</span>
              </h3>
              <div className="anissa-client-list">
                {filteredShared.map((client, i) => (
                  <ClientCard key={client.id} client={client} i={i} onConsultation={onConsultation} onViewHistory={onViewHistory} onOpen={onOpenClient} isOwn={false} onRefresh={onRefresh} onViewReview={(review, c) => { setSelectedReview(review); setSelectedReviewClient(c); }} onReturnPlan={(c) => { if (onReturnPlan) onReturnPlan(c); }} onSendPackReview={onSendPackReview} />
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
