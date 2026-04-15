import { useState } from 'react';
import { analyzeCycleReview } from './services/aiClient';
import { adaptPlanFromReview } from './services/aiPlanOptimizer';
import { getNutritionConsultations } from './store';

const ADHERENCE_LABELS = {
  '100': '✅ Tous les jours',
  '75':  '🟡 75% du temps',
  '50':  '🟠 50% du temps',
  '<50': '🔴 Moins de 50%',
};
const CHEATS_LABELS = {
  none:       '✅ Aucun',
  occasional: '🟡 Occasionnels',
  frequent:   '🔴 Fréquents',
};
const PROGRESS_LABELS = {
  yes:    '✅ Oui clairement',
  little: '🟡 Un peu',
  none:   '🔴 Pas encore',
};
const ENERGY_LABELS = {
  high:   '⚡ Meilleure',
  normal: '➡️ Stable',
  low:    '🔋 Moins bonne',
};
const DIGESTION_LABELS = {
  good:    '✅ Bonne',
  average: '🟡 Moyenne',
  bad:     '🔴 Difficile',
};
const DIFFICULTY_LABELS = {
  easy: '✅ Facile à suivre',
  ok:   '🟡 Correct',
  hard: '🔴 Trop difficile',
};
const ORGANISATION_LABELS = {
  simple:  '✅ Simple',
  medium:  '🟡 Gérable',
  complex: '🔴 Compliquée',
};
const ISSUE_LABELS = {
  time:       'Manque de temps',
  taste:      'Aliments pas appréciés',
  hunger:     'Faim entre les repas',
  cost:       'Coût alimentaire',
  social:     'Social / restaurants',
  motivation: 'Motivation',
  complexity: 'Plan trop complexe',
  other:      'Autre',
};

function ScoreBar({ label, value }) {
  const color = value >= 7 ? '#4ade80' : value >= 5 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        fontSize:'.75rem', marginBottom:4 }}>
        <span style={{ color:'#b0c4a8' }}>{label}</span>
        <span style={{ color, fontWeight:700 }}>{value}/10</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,.06)', borderRadius:100 }}>
        <div style={{ height:'100%', width:`${value*10}%`,
          background:color, borderRadius:100, transition:'width .4s ease' }} />
      </div>
    </div>
  );
}

export default function CycleReviewPanel({ review, client, onClose, onOpenConsultation, onAdaptPlan }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [adapting, setAdapting] = useState(false);
  const [adaptedPlan, setAdaptedPlan] = useState(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeCycleReview(client?.form || {}, review);
      if (result) setAnalysis(result);
      else setError('Analyse échouée — réessayez');
    } catch {
      setError('Erreur IA — réessayez');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAdaptPlan = async () => {
    setAdapting(true);
    setError('');
    try {
      const consultations = getNutritionConsultations(client?.id);
      const lastConsultation = consultations?.[0];
      const currentPlan = lastConsultation?.nutritionPlan
        || lastConsultation?.nutrition_plan
        || '';

      if (!currentPlan.trim()) {
        setError('Aucun plan trouvé pour ce client. Créez d\'abord une consultation.');
        setAdapting(false);
        return;
      }

      const result = await adaptPlanFromReview(
        client?.form || {},
        currentPlan,
        review,
        analysis
      );
      if (result) setAdaptedPlan(result);
      else setError('Adaptation échouée — réessayez');
    } catch (err) {
      setError('Erreur lors de l\'adaptation — réessayez');
    } finally {
      setAdapting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-CH', {
      day:'2-digit', month:'2-digit', year:'numeric'
    });
  };

  return (
    <div
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.6)',
        zIndex:300, display:'flex', alignItems:'center', justifyContent:'center',
        padding:20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:'#1a2e1f', border:'1px solid rgba(106,191,138,.2)',
          borderRadius:16, width:'100%', maxWidth:480,
          maxHeight:'85vh', overflow:'hidden',
          display:'flex', flexDirection:'column',
          boxShadow:'0 20px 60px rgba(0,0,0,.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding:'16px 20px',
          borderBottom:'1px solid rgba(255,255,255,.06)',
          display:'flex', alignItems:'center', gap:10,
          flexShrink:0,
        }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:'.95rem', color:'#f0f0e8' }}>
              Bilan 4 semaines — {client?.prenom || 'Client'}
            </div>
            <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.35)', marginTop:2 }}>
              Soumis le {formatDate(review.submitted_at || review.created_at)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'none', border:'none', color:'rgba(255,255,255,.4)',
            cursor:'pointer', fontSize:'1.2rem', padding:'4px 8px',
          }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY:'auto', flex:1, padding:'16px 20px' }}>

          {/* Résumé */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:'.68rem', fontWeight:700,
              color:'rgba(106,191,138,.6)', textTransform:'uppercase',
              letterSpacing:'.4px', marginBottom:12 }}>
              Résumé du bilan
            </div>

            {[
              { label:'Adhérence', value: ADHERENCE_LABELS[review.adherence] },
              { label:'Écarts',    value: CHEATS_LABELS[review.cheats] },
              { label:'Progression', value: PROGRESS_LABELS[review.progress] },
              { label:'Énergie',   value: ENERGY_LABELS[review.energy] },
              { label:'Digestion', value: DIGESTION_LABELS[review.digestion] },
              { label:'Difficulté plan', value: DIFFICULTY_LABELS[review.difficulty] },
              { label:'Organisation',    value: ORGANISATION_LABELS[review.organisation] },
              { label:'Problème principal', value: ISSUE_LABELS[review.main_issue] || review.main_issue },
            ].filter(r => r.value).map(row => (
              <div key={row.label} style={{
                display:'flex', justifyContent:'space-between',
                padding:'7px 0',
                borderBottom:'1px solid rgba(255,255,255,.04)',
                fontSize:'.82rem',
              }}>
                <span style={{ color:'rgba(255,255,255,.4)' }}>{row.label}</span>
                <span style={{ color:'#e0d8c0', fontWeight:500 }}>{row.value}</span>
              </div>
            ))}

            {review.main_issue_text && (
              <div style={{
                marginTop:10, padding:'10px 12px',
                background:'rgba(255,255,255,.03)',
                borderRadius:8, fontSize:'.8rem',
                color:'#b0c4a8', fontStyle:'italic',
                border:'1px solid rgba(255,255,255,.06)',
              }}>
                "{review.main_issue_text}"
              </div>
            )}
          </div>

          {/* Analyse IA */}
          {!analysis && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              style={{
                width:'100%', padding:'11px',
                borderRadius:10,
                border:'1px solid rgba(106,191,138,.3)',
                background: analyzing ? 'rgba(106,191,138,.06)' : 'rgba(106,191,138,.12)',
                color: analyzing ? 'rgba(106,191,138,.5)' : '#8abf9a',
                cursor: analyzing ? 'not-allowed' : 'pointer',
                fontSize:'.85rem', fontWeight:600,
                display:'flex', alignItems:'center',
                justifyContent:'center', gap:8,
                transition:'all .2s',
              }}
              onMouseEnter={e => { if (!analyzing) e.currentTarget.style.background='rgba(106,191,138,.2)'; }}
              onMouseLeave={e => { if (!analyzing) e.currentTarget.style.background='rgba(106,191,138,.12)'; }}
            >
              {analyzing
                ? <><span style={{ animation:'neSpin .8s linear infinite', display:'inline-block' }}>✨</span> Analyse en cours...</>
                : '✨ Analyser avec l\'IA'
              }
            </button>
          )}

          {error && (
            <div style={{ fontSize:'.78rem', color:'#f87171',
              textAlign:'center', marginTop:8 }}>{error}</div>
          )}

          {analysis && (
            <div style={{
              marginTop:4,
              padding:'14px',
              background:'rgba(26,46,31,.4)',
              border:'1px solid rgba(106,191,138,.2)',
              borderRadius:12,
              animation:'neSlideIn .2s ease',
            }}>
              <div style={{ fontSize:'.68rem', fontWeight:700,
                color:'rgba(106,191,138,.6)', textTransform:'uppercase',
                letterSpacing:'.4px', marginBottom:12 }}>
                ✨ Analyse IA
              </div>

              {/* Diagnostic */}
              <div style={{ fontSize:'.85rem', color:'#e0d8c0',
                lineHeight:1.6, marginBottom:14,
                paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                {analysis.diagnostic}
              </div>

              {/* Cause dominante */}
              {analysis.cause_dominante && (
                <div style={{ fontSize:'.78rem', color:'#fbbf24',
                  marginBottom:14, display:'flex', gap:6, alignItems:'flex-start' }}>
                  <span>⚠️</span>
                  <span>{analysis.cause_dominante}</span>
                </div>
              )}

              {/* Scores */}
              {analysis.scores && (
                <div style={{ marginBottom:14,
                  paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                  <ScoreBar label="Adhérence" value={analysis.scores.adherence} />
                  <ScoreBar label="Résultats" value={analysis.scores.resultats} />
                  <ScoreBar label="Bien-être" value={analysis.scores.bien_etre} />
                </div>
              )}

              {/* Recommandations */}
              {analysis.recommandations?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:'.72rem', fontWeight:700,
                    color:'rgba(96,165,250,.7)', textTransform:'uppercase',
                    letterSpacing:'.4px', marginBottom:8 }}>
                    ⚡ Pour le prochain cycle
                  </div>
                  {analysis.recommandations.map((r, i) => (
                    <div key={i} style={{
                      fontSize:'.8rem', color:'#b0c4a8',
                      paddingLeft:10,
                      borderLeft:'2px solid rgba(96,165,250,.3)',
                      marginBottom:6, lineHeight:1.4,
                    }}>
                      {r}
                    </div>
                  ))}
                </div>
              )}

              {/* Prochain cycle */}
              {analysis.prochain_cycle && (
                <div style={{
                  padding:'10px 12px',
                  background:'rgba(106,191,138,.07)',
                  border:'1px solid rgba(106,191,138,.2)',
                  borderRadius:8, fontSize:'.8rem',
                  color:'#8abf9a', lineHeight:1.5,
                }}>
                  🎯 {analysis.prochain_cycle}
                </div>
              )}

              {/* Bouton Adapter le plan */}
              {!adaptedPlan && (
                <button
                  onClick={handleAdaptPlan}
                  disabled={adapting}
                  style={{
                    width:'100%', marginTop:12, padding:'10px',
                    borderRadius:8, border:'1px solid rgba(197,176,122,.3)',
                    background: adapting ? 'rgba(197,176,122,.06)' : 'rgba(197,176,122,.12)',
                    color: adapting ? 'rgba(197,176,122,.4)' : '#c5b07a',
                    cursor: adapting ? 'not-allowed' : 'pointer',
                    fontSize:'.83rem', fontWeight:600,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    transition:'all .2s',
                  }}
                  onMouseEnter={e => { if (!adapting) e.currentTarget.style.background='rgba(197,176,122,.22)'; }}
                  onMouseLeave={e => { if (!adapting) e.currentTarget.style.background='rgba(197,176,122,.12)'; }}
                >
                  {adapting
                    ? <><span style={{ animation:'neSpin .8s linear infinite', display:'inline-block' }}>⚙️</span> Adaptation en cours...</>
                    : '⚙️ Adapter automatiquement le plan'
                  }
                </button>
              )}

              {/* Plan adapté — aperçu + confirmation */}
              {adaptedPlan && (
                <div style={{
                  marginTop:12,
                  padding:'12px 14px',
                  background:'rgba(197,176,122,.06)',
                  border:'1px solid rgba(197,176,122,.25)',
                  borderRadius:10,
                  animation:'neSlideIn .2s ease',
                }}>
                  <div style={{ fontSize:'.7rem', fontWeight:700,
                    color:'rgba(197,176,122,.7)', textTransform:'uppercase',
                    letterSpacing:'.4px', marginBottom:8 }}>
                    ⚙️ Plan adapté — Aperçu
                  </div>
                  <div style={{
                    fontSize:'.75rem', color:'#b0c4a8', lineHeight:1.55,
                    whiteSpace:'pre-wrap', maxHeight:120, overflowY:'auto',
                    background:'rgba(0,0,0,.2)', borderRadius:6,
                    padding:'8px 10px', marginBottom:10,
                    border:'1px solid rgba(255,255,255,.05)',
                  }}>
                    {adaptedPlan.slice(0, 400)}{adaptedPlan.length > 400 ? '...' : ''}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      onClick={() => {
                        onAdaptPlan(adaptedPlan);
                        onClose();
                      }}
                      style={{
                        flex:1, padding:'8px', borderRadius:7, border:'none',
                        background:'rgba(197,176,122,.25)', color:'#c5b07a',
                        cursor:'pointer', fontSize:'.8rem', fontWeight:700,
                        transition:'all .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(197,176,122,.4)'}
                      onMouseLeave={e => e.currentTarget.style.background='rgba(197,176,122,.25)'}
                    >
                      ✅ Ouvrir dans l'éditeur
                    </button>
                    <button
                      onClick={() => setAdaptedPlan(null)}
                      style={{
                        padding:'8px 14px', borderRadius:7,
                        border:'1px solid rgba(255,255,255,.08)',
                        background:'none', color:'rgba(255,255,255,.3)',
                        cursor:'pointer', fontSize:'.8rem',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* CTA */}
              {onOpenConsultation && (
                <button
                  onClick={() => { onClose(); onOpenConsultation(client.id); }}
                  style={{
                    width:'100%', marginTop:14, padding:'10px',
                    borderRadius:8, border:'none',
                    background:'rgba(106,191,138,.2)', color:'#8abf9a',
                    cursor:'pointer', fontSize:'.83rem', fontWeight:600,
                    transition:'all .2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(106,191,138,.35)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(106,191,138,.2)'}
                >
                  + Préparer la prochaine consultation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
