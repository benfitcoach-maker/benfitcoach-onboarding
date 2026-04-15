import { useState } from 'react';
import { analyzeCycleReview } from './services/aiClient';

const ADHERENCE_LABELS = {
  '100': '\u2705 Tous les jours',
  '75':  '\ud83d\udfe1 75% du temps',
  '50':  '\ud83d\udfe0 50% du temps',
  '<50': '\ud83d\udd34 Moins de 50%',
};
const CHEATS_LABELS = {
  none:       '\u2705 Aucun',
  occasional: '\ud83d\udfe1 Occasionnels',
  frequent:   '\ud83d\udd34 Fr\u00e9quents',
};
const PROGRESS_LABELS = {
  yes:    '\u2705 Oui clairement',
  little: '\ud83d\udfe1 Un peu',
  none:   '\ud83d\udd34 Pas encore',
};
const ENERGY_LABELS = {
  high:   '\u26a1 Meilleure',
  normal: '\u27a1\ufe0f Stable',
  low:    '\ud83d\udd0b Moins bonne',
};
const DIGESTION_LABELS = {
  good:    '\u2705 Bonne',
  average: '\ud83d\udfe1 Moyenne',
  bad:     '\ud83d\udd34 Difficile',
};
const DIFFICULTY_LABELS = {
  easy: '\u2705 Facile \u00e0 suivre',
  ok:   '\ud83d\udfe1 Correct',
  hard: '\ud83d\udd34 Trop difficile',
};
const ORGANISATION_LABELS = {
  simple:  '\u2705 Simple',
  medium:  '\ud83d\udfe1 G\u00e9rable',
  complex: '\ud83d\udd34 Compliqu\u00e9e',
};
const ISSUE_LABELS = {
  time:       'Manque de temps',
  taste:      'Aliments pas appr\u00e9ci\u00e9s',
  hunger:     'Faim entre les repas',
  cost:       'Co\u00fbt alimentaire',
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

export default function CycleReviewPanel({ review, client, onClose, onOpenConsultation }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeCycleReview(client?.form || {}, review);
      if (result) setAnalysis(result);
      else setError('Analyse \u00e9chou\u00e9e \u2014 r\u00e9essayez');
    } catch {
      setError('Erreur IA \u2014 r\u00e9essayez');
    } finally {
      setAnalyzing(false);
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
          }}>{'\u2715'}</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY:'auto', flex:1, padding:'16px 20px' }}>

          {/* VUE 1 — R\u00e9sum\u00e9 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:'.68rem', fontWeight:700,
              color:'rgba(106,191,138,.6)', textTransform:'uppercase',
              letterSpacing:'.4px', marginBottom:12 }}>
              R\u00e9sum\u00e9 du bilan
            </div>

            {[
              { label:'Adh\u00e9rence', value: ADHERENCE_LABELS[review.adherence] },
              { label:'\u00c9carts',    value: CHEATS_LABELS[review.cheats] },
              { label:'Progression', value: PROGRESS_LABELS[review.progress] },
              { label:'\u00c9nergie',   value: ENERGY_LABELS[review.energy] },
              { label:'Digestion', value: DIGESTION_LABELS[review.digestion] },
              { label:'Difficult\u00e9 plan', value: DIFFICULTY_LABELS[review.difficulty] },
              { label:'Organisation',    value: ORGANISATION_LABELS[review.organisation] },
              { label:'Probl\u00e8me principal', value: ISSUE_LABELS[review.main_issue] || review.main_issue },
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

          {/* VUE 2 — Analyse IA */}
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
                ? <><span style={{ animation:'neSpin .8s linear infinite', display:'inline-block' }}>{'\u2728'}</span> Analyse en cours...</>
                : '\u2728 Analyser avec l\'IA'
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
                {'\u2728'} Analyse IA
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
                  <span>{'\u26a0\ufe0f'}</span>
                  <span>{analysis.cause_dominante}</span>
                </div>
              )}

              {/* Scores */}
              {analysis.scores && (
                <div style={{ marginBottom:14,
                  paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                  <ScoreBar label="Adh\u00e9rence" value={analysis.scores.adherence} />
                  <ScoreBar label="R\u00e9sultats" value={analysis.scores.resultats} />
                  <ScoreBar label="Bien-\u00eatre" value={analysis.scores.bien_etre} />
                </div>
              )}

              {/* Recommandations */}
              {analysis.recommandations?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:'.72rem', fontWeight:700,
                    color:'rgba(96,165,250,.7)', textTransform:'uppercase',
                    letterSpacing:'.4px', marginBottom:8 }}>
                    {'\u26a1'} Pour le prochain cycle
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
                  {'\ud83c\udfaf'} {analysis.prochain_cycle}
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
                  + Pr\u00e9parer la prochaine consultation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
