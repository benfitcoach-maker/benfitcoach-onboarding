// ─── AntiSlopSection.jsx ────────────────────────────────────────────────
// V97.x Phase 3-4 — UI anti-slop : bouton "Lancer audit" + banner flags
// detected avec reformulation Haiku par flag.
// V97.27 (refacto) — Extrait depuis JourneyPlanEditor.jsx.
//
// 7 categories detectees : rule_of_three, ai_vocab, cliche,
// symmetric_sections, parallel_bullets, title_chevron, excess_caps.
//
// Phase 3 = heuristiques uniquement (déterministe, gratuit, instantané).
// Phase 4 = reformulation LLM ciblée des sections flaggées.

import {
  summarizeSlopFlags,
  CATEGORY_LABELS as SLOP_CATEGORY_LABELS,
} from '../services/prompts/nutrition/_antiSlop.fr';

export function AntiSlopSection({ flags, running, onRun, rewrites = {}, planText, onRewrite, onAcceptRewrite, onRefuseRewrite }) {
  // Pas encore lancé
  if (flags === null && !running) {
    return (
      <div style={{
        marginBottom: 12,
        padding: '10px 14px',
        background: 'rgba(167, 139, 250, 0.06)',
        border: '1px dashed rgba(167, 139, 250, 0.3)',
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 12, color: 'var(--jrn-text-soft, #6b6f6b)', flex: 1, minWidth: 200 }}>
          <strong style={{ color: '#7e5ec7' }}>Audit anti-slop disponible.</strong>
          {' '}Détecte les patterns AI visibles (rule-of-three, vocab AI, clichés, symétrie de sections, etc.) avant l&apos;export Word.
        </div>
        <button
          type="button"
          onClick={onRun}
          style={{
            background: '#7e5ec7',
            border: '1px solid #7e5ec7',
            borderRadius: 6,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: 'white',
            cursor: 'pointer',
          }}
        >
          ⚡ Lancer l&apos;audit
        </button>
      </div>
    );
  }

  if (running) {
    return (
      <div style={{
        marginBottom: 12,
        padding: '10px 14px',
        background: 'rgba(167, 139, 250, 0.08)',
        border: '1px solid rgba(167, 139, 250, 0.3)',
        borderRadius: 8,
        fontSize: 12,
        color: '#7e5ec7',
      }}>
        Audit anti-slop en cours...
      </div>
    );
  }

  // flags est un tableau (peut être vide)
  if (!flags || flags.length === 0) {
    return (
      <div style={{
        marginBottom: 12,
        padding: '10px 14px',
        background: 'rgba(46, 94, 62, 0.06)',
        border: '1px solid rgba(46, 94, 62, 0.25)',
        borderRadius: 8,
        fontSize: 12,
        color: '#2E5E3E',
      }}>
        <strong>✓ Audit anti-slop : 0 pattern détecté.</strong>
        {' '}Le plan a un ton naturel. Prêt à adopter.
      </div>
    );
  }

  // Group flags by severity
  const severityOrder = ['high', 'medium', 'low'];
  const summary = summarizeSlopFlags(flags);
  summary.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
  const highCount = flags.filter((f) => f.severity === 'high').length;
  const tone = highCount > 0 ? 'high' : (flags.length >= 4 ? 'medium' : 'low');
  const palette = tone === 'high'
    ? { bg: 'rgba(184, 64, 64, 0.06)', border: 'rgba(184, 64, 64, 0.35)', fg: '#a04040' }
    : tone === 'medium'
    ? { bg: 'rgba(184, 134, 38, 0.06)', border: 'rgba(184, 134, 38, 0.3)', fg: '#785a1a' }
    : { bg: 'rgba(167, 139, 250, 0.06)', border: 'rgba(167, 139, 250, 0.3)', fg: '#7e5ec7' };

  return (
    <div style={{
      marginBottom: 12,
      padding: '12px 14px',
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
    }}>
      <div style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: palette.fg,
        marginBottom: 8,
      }}>
        ⚡ Audit anti-slop : {flags.length} pattern{flags.length > 1 ? 's' : ''} détecté{flags.length > 1 ? 's' : ''}
        {highCount > 0 && (
          <span style={{ marginLeft: 8, fontSize: 10 }}>
            ({highCount} high{highCount > 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* Summary par catégorie */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {summary.map((s) => (
          <span
            key={s.category}
            style={{
              fontSize: 10.5,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'white',
              color: palette.fg,
              border: `1px solid ${palette.border}`,
              fontWeight: 600,
            }}
            title={`severity max : ${s.severity}`}
          >
            {SLOP_CATEGORY_LABELS[s.category] || s.category} × {s.count}
          </span>
        ))}
      </div>

      {/* Top 5 flags détaillés avec reformulation Haiku par flag (Phase 4) */}
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 11.5, color: palette.fg, lineHeight: 1.5 }}>
        {flags.slice(0, 5).map((f) => {
          const rewrite = rewrites[f.id];
          // On peut reformuler uniquement si la ligne du plan est extractible
          const lines = (planText || '').split('\n');
          const lineText = typeof f.lineIndex === 'number' ? lines[f.lineIndex] : '';
          const canRewrite = !!(lineText && lineText.trim().length > 0 && typeof onRewrite === 'function');
          return (
            <li key={f.id} style={{ marginBottom: 10, paddingLeft: 16, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, top: 0 }}>
                {f.severity === 'high' ? '●' : f.severity === 'medium' ? '◐' : '○'}
              </span>
              <div>
                <strong>{SLOP_CATEGORY_LABELS[f.category] || f.category}</strong>
                {' — '}
                <em style={{ fontWeight: 400 }}>{f.snippet}</em>
              </div>
              {f.suggestion && (
                <div style={{ marginTop: 2, fontSize: 10.5, fontStyle: 'italic', opacity: 0.8 }}>
                  → {f.suggestion}
                </div>
              )}

              {/* Bouton "Reformuler (Haiku)" si pas encore lancé sur ce flag */}
              {canRewrite && !rewrite && (
                <button
                  type="button"
                  onClick={() => onRewrite(f)}
                  style={{
                    marginTop: 4,
                    background: 'white',
                    border: `1px solid ${palette.border}`,
                    borderRadius: 6,
                    padding: '3px 9px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: palette.fg,
                    cursor: 'pointer',
                  }}
                  title="Reformule ce passage via Claude Haiku, voix Anissa"
                >
                  ✎ Reformuler ce passage
                </button>
              )}

              {/* Loading */}
              {rewrite?.status === 'loading' && (
                <div style={{ marginTop: 4, fontSize: 10.5, fontStyle: 'italic', color: palette.fg, opacity: 0.8 }}>
                  Reformulation en cours…
                </div>
              )}

              {/* Erreur */}
              {rewrite?.status === 'error' && (
                <div style={{ marginTop: 4, fontSize: 10.5, color: '#a04040' }}>
                  Erreur reformulation : {rewrite.error}
                  <button
                    type="button"
                    onClick={() => onRewrite(f)}
                    style={{
                      marginLeft: 8,
                      background: 'transparent',
                      border: `1px solid ${palette.border}`,
                      borderRadius: 5,
                      padding: '1px 7px',
                      fontSize: 10,
                      color: palette.fg,
                      cursor: 'pointer',
                    }}
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {/* Reformulation prête — affiche original vs reformulé + Accept/Refuse */}
              {rewrite?.status === 'ready' && (
                <div style={{
                  marginTop: 6,
                  padding: '8px 10px',
                  background: 'white',
                  border: `1px solid ${palette.border}`,
                  borderRadius: 6,
                  fontSize: 11,
                  color: '#2a2d2a',
                }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: palette.fg, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      Original
                    </span>
                    <div style={{ marginTop: 2, fontStyle: 'italic', opacity: 0.7 }}>
                      {rewrite.original}
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2E5E3E', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      Reformulé
                    </span>
                    <div style={{ marginTop: 2 }}>
                      {rewrite.text}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onAcceptRewrite(f)}
                      style={{
                        background: '#2E5E3E',
                        border: '1px solid #2E5E3E',
                        borderRadius: 5,
                        padding: '4px 11px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Accepter
                    </button>
                    <button
                      type="button"
                      onClick={() => onRefuseRewrite(f)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${palette.border}`,
                        borderRadius: 5,
                        padding: '4px 11px',
                        fontSize: 11,
                        color: palette.fg,
                        cursor: 'pointer',
                      }}
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              )}

              {/* Accepted */}
              {rewrite?.status === 'accepted' && (
                <div style={{ marginTop: 4, fontSize: 10.5, color: '#2E5E3E', fontWeight: 600 }}>
                  ✓ Reformulation appliquée au plan.
                </div>
              )}

              {/* Refused */}
              {rewrite?.status === 'refused' && (
                <div style={{ marginTop: 4, fontSize: 10.5, fontStyle: 'italic', opacity: 0.7 }}>
                  Reformulation refusée.
                  <button
                    type="button"
                    onClick={() => onRewrite(f)}
                    style={{
                      marginLeft: 8,
                      background: 'transparent',
                      border: `1px solid ${palette.border}`,
                      borderRadius: 5,
                      padding: '1px 7px',
                      fontSize: 10,
                      color: palette.fg,
                      cursor: 'pointer',
                    }}
                  >
                    Refaire
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {flags.length > 5 && (
          <li style={{ fontSize: 10.5, fontStyle: 'italic', opacity: 0.7, paddingLeft: 16 }}>
            … et {flags.length - 5} autre{flags.length - 5 > 1 ? 's' : ''} pattern{flags.length - 5 > 1 ? 's' : ''}.
          </li>
        )}
      </ul>

      {tone === 'high' && (
        <div style={{ marginTop: 10, fontSize: 11, color: palette.fg, fontStyle: 'italic' }}>
          → Patterns forts détectés. Considère de regénérer ou éditer manuellement avant export Word.
        </div>
      )}
    </div>
  );
}
