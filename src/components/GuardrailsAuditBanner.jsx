// ─── GuardrailsAuditBanner.jsx ──────────────────────────────────────────
// V97.x Phase 2 — Banner audit clinique post-génération.
// V97.27 (refacto) — Extrait depuis JourneyPlanEditor.jsx.
//
// Affiche en tête du résultat un récap visuel :
//  - Profils détectés (chip violet)
//  - Violations (rouge doux) si phrases interdites détectées
//  - Manques (ocre) si micronutriments / évictions absents
//  - Tout vert si plan clean
//
// Permet à Anissa de voir en 5 sec si le draft est cliniquement OK avant
// de l'adopter. Si violations → "Régénérer" recommandé.

export function GuardrailsAuditBanner({ state }) {
  if (!state?.guardrails?.length) return null;

  const profileNames = state.guardrails.map((g) => g.display_name);
  const violations = state.violations || [];
  const completeness = state.completeness || null;
  const missingMicros = completeness?.missing_micronutrients || [];
  const missingEvictions = completeness?.missing_evictions || [];
  const missingRequired = completeness?.missing_required_phrases || [];

  const hasIssues =
    violations.length > 0 ||
    missingMicros.length > 0 ||
    missingEvictions.length > 0 ||
    missingRequired.length > 0;

  const tone = violations.length > 0 ? 'warn' : (hasIssues ? 'info' : 'ok');
  const palette = tone === 'warn'
    ? { bg: 'rgba(184, 64, 64, 0.06)', border: 'rgba(184, 64, 64, 0.35)', fg: '#a04040' }
    : tone === 'info'
    ? { bg: 'rgba(184, 134, 38, 0.06)', border: 'rgba(184, 134, 38, 0.3)', fg: '#785a1a' }
    : { bg: 'rgba(46, 94, 62, 0.06)', border: 'rgba(46, 94, 62, 0.25)', fg: '#2E5E3E' };

  return (
    <div style={{
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: palette.fg,
        }}>
          {tone === 'warn' ? '⚠ Audit clinique' : tone === 'info' ? 'ℹ Audit clinique' : '✓ Audit clinique OK'}
        </span>
        {profileNames.map((name) => (
          <span key={name} style={{
            fontSize: 10.5,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'white',
            color: palette.fg,
            border: `1px solid ${palette.border}`,
          }}>
            {name}
          </span>
        ))}
      </div>

      {violations.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a04040', marginBottom: 4 }}>
            {violations.length} phrase{violations.length > 1 ? 's' : ''} interdite{violations.length > 1 ? 's' : ''} détectée{violations.length > 1 ? 's' : ''} :
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#a04040', lineHeight: 1.5 }}>
            {violations.slice(0, 5).map((v, i) => (
              <li key={i}>
                <strong>{v.phrase}</strong> — <em>{v.snippet}</em>
              </li>
            ))}
            {violations.length > 5 && (
              <li><em>… et {violations.length - 5} autre{violations.length - 5 > 1 ? 's' : ''}</em></li>
            )}
          </ul>
        </div>
      )}

      {(missingMicros.length > 0 || missingEvictions.length > 0 || missingRequired.length > 0) && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: palette.fg, marginBottom: 4 }}>
            Compléments à ajouter manuellement :
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: palette.fg, lineHeight: 1.5 }}>
            {missingMicros.length > 0 && (
              <li>
                <strong>Micronutriments manquants :</strong>{' '}
                {missingMicros.map((m) => m.item).join(', ')}
              </li>
            )}
            {missingEvictions.length > 0 && (
              <li>
                <strong>Évictions à mentionner :</strong>{' '}
                {missingEvictions.map((e) => e.item).join(', ')}
              </li>
            )}
            {missingRequired.length > 0 && (
              <li>
                <strong>Formulations attendues :</strong>{' '}
                {missingRequired.map((r) => `"${r.phrase}"`).join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}

      {!hasIssues && (
        <div style={{ fontSize: 11.5, color: palette.fg }}>
          Tous les garde-fous cliniques sont respectés. Plan prêt à adopter.
        </div>
      )}

      {violations.length > 0 && (
        <div style={{
          marginTop: 10,
          fontSize: 11,
          color: '#a04040',
          fontStyle: 'italic',
        }}>
          → Régénération recommandée. Si le problème persiste, édite manuellement avant adoption.
        </div>
      )}
    </div>
  );
}
