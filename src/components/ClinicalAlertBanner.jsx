// ─── ClinicalAlertBanner ────────────────────────────────────────────────
// V97.17.20 — Detection automatique de patterns preoccupants dans les
// ressentis cliente. Anissa voit un banner contextuel si signal recurrent
// sur les derniers feedbacks (5-7 jours).
//
// Patterns detectes :
//   - Digestion degradee : 3+ ressentis 'worse' sur 7 derniers jours
//   - Fatigue persistante : 3+ ressentis fatigue 'worse'
//   - Energie basse persistante : 3+ ressentis energie 'low'
//   - Faim derangee : 3+ ressentis faim != 'ok' (extreme : 'low' ou 'high')
//
// Si aucun pattern → banner masque. Si plusieurs → tous affiches.
//
// Ne remplace pas l'action prioritaire (V97.13.21), complete avec des
// signaux PATTERN-BASED (vs single-shot).

import { useMemo } from 'react';

const PATTERN_WINDOW = 7; // derniers N feedbacks scannes
const PATTERN_THRESHOLD = 3; // N+ occurrences pour declencher

function countOccurrences(feedbacks, key, value) {
  return feedbacks.filter((f) => f[key] === value).length;
}

function buildPatterns(feedbacks) {
  if (!Array.isArray(feedbacks) || feedbacks.length < PATTERN_THRESHOLD) return [];

  // Prendre les N plus recents (deja tries desc par created_at en amont)
  const recent = feedbacks.slice(0, PATTERN_WINDOW);
  const patterns = [];

  // 1. Digestion en degradation
  const digestionBad = countOccurrences(recent, 'digestion', 'worse');
  if (digestionBad >= PATTERN_THRESHOLD) {
    patterns.push({
      id: 'digestion-down',
      tone: 'warn',
      label: `Digestion en degradation`,
      detail: `${digestionBad} ressentis 'Pire' sur les ${recent.length} derniers jours. Penser : reaction alimentaire, supplements mal toleres, stress.`,
      action: 'Programmer une consultation pour discuter',
    });
  }

  // 2. Fatigue persistante
  const fatigueBad = countOccurrences(recent, 'fatigue', 'worse');
  if (fatigueBad >= PATTERN_THRESHOLD) {
    patterns.push({
      id: 'fatigue-persistent',
      tone: 'warn',
      label: `Fatigue persistante`,
      detail: `${fatigueBad} ressentis 'Pire' sur les ${recent.length} derniers jours. Penser : carences (fer, B12), sommeil, surcharge inflammatoire.`,
      action: 'Verifier marqueurs biologiques + envisager adaptation',
    });
  }

  // 3. Energie basse persistante
  const energieLow = countOccurrences(recent, 'energie', 'low');
  if (energieLow >= PATTERN_THRESHOLD) {
    patterns.push({
      id: 'energie-low',
      tone: 'warn',
      label: `Energie basse persistante`,
      detail: `${energieLow} ressentis 'Basse' sur les ${recent.length} derniers jours.`,
      action: 'Pister thyroide, glycemie, sommeil',
    });
  }

  // 4. Faim derangee (low ou high)
  const faimLow = countOccurrences(recent, 'faim', 'low');
  const faimHigh = countOccurrences(recent, 'faim', 'high');
  if (faimLow >= PATTERN_THRESHOLD) {
    patterns.push({
      id: 'faim-low',
      tone: 'info',
      label: `Faim diminuee`,
      detail: `${faimLow} ressentis 'Pas assez' sur les ${recent.length} derniers jours. Probable adaptation hormonale en cours.`,
      action: null,
    });
  }
  if (faimHigh >= PATTERN_THRESHOLD) {
    patterns.push({
      id: 'faim-high',
      tone: 'warn',
      label: `Faim accrue`,
      detail: `${faimHigh} ressentis 'Trop' sur les ${recent.length} derniers jours. Penser : densite nutritionnelle insuffisante, glycemie instable.`,
      action: 'Revoir composition des repas (lipides + proteines)',
    });
  }

  // 5. Signal positif : amelioration soutenue (3+ ressentis 'better' digestion ou fatigue)
  const digestionBetter = countOccurrences(recent, 'digestion', 'better');
  const fatigueBetter = countOccurrences(recent, 'fatigue', 'better');
  const energieGood = countOccurrences(recent, 'energie', 'good');
  if (
    digestionBetter >= PATTERN_THRESHOLD ||
    fatigueBetter >= PATTERN_THRESHOLD ||
    energieGood >= PATTERN_THRESHOLD
  ) {
    const dims = [];
    if (digestionBetter >= PATTERN_THRESHOLD) dims.push('digestion');
    if (fatigueBetter >= PATTERN_THRESHOLD) dims.push('fatigue resorbee');
    if (energieGood >= PATTERN_THRESHOLD) dims.push('energie');
    patterns.push({
      id: 'positive-trend',
      tone: 'ok',
      label: `Amelioration soutenue`,
      detail: `Tendance positive sur : ${dims.join(', ')}. Bon moment pour suggerer une transition de phase si pertinent.`,
      action: null,
    });
  }

  return patterns;
}

export default function ClinicalAlertBanner({ feedbacks, syncError = false }) {
  const patterns = useMemo(() => buildPatterns(feedbacks), [feedbacks]);

  // P2.1 — le silence n'est un mensonge QUE sous panne. Si la synchro a échoué,
  // on ne peut PAS conclure « aucun signal préoccupant » (on a reçu un tableau
  // vidé, pas une absence réelle de pattern) → on l'avoue au lieu de disparaître.
  if (syncError) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={eyebrowStyle}>Signaux cliniques</span>
        </div>
        <div style={{ ...patternStyle, ...syncErrorBoxStyle }}>
          <div style={{ ...patternLabelStyle, color: '#785a1a' }}>
            ⚠ Évaluation impossible — synchro app cliente échouée
          </div>
          <div style={{ ...patternDetailStyle, color: 'rgba(120, 90, 26, 0.85)' }}>
            Les ressentis n'ont pas pu être récupérés. L'absence d'alerte ci-dessous
            n'est pas vérifiée — relancer la synchro pour évaluer les patterns.
          </div>
        </div>
      </div>
    );
  }

  // Synchro OK + aucun pattern = vérité : la cliente n'a pas d'alerte → silence.
  if (patterns.length === 0) return null;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={eyebrowStyle}>Signaux cliniques</span>
        <span style={countPillStyle}>
          {patterns.length} pattern{patterns.length > 1 ? 's' : ''} sur 7 jours
        </span>
      </div>
      <div style={listStyle}>
        {patterns.map((p) => {
          const colors = toneColors(p.tone);
          return (
            <div
              key={p.id}
              style={{
                ...patternStyle,
                background: colors.bg,
                borderColor: colors.border,
              }}
            >
              <div style={{ ...patternLabelStyle, color: colors.fg }}>
                {p.tone === 'warn' ? '⚠' : p.tone === 'ok' ? '✓' : 'ℹ'} {p.label}
              </div>
              <div style={{ ...patternDetailStyle, color: colors.fgSoft }}>
                {p.detail}
              </div>
              {p.action && (
                <div style={{ ...patternActionStyle, color: colors.fg }}>
                  → {p.action}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function toneColors(tone) {
  switch (tone) {
    case 'warn':
      return {
        bg: 'rgba(184, 134, 38, 0.06)',
        border: 'rgba(184, 134, 38, 0.3)',
        fg: '#785a1a',
        fgSoft: 'rgba(120, 90, 26, 0.85)',
      };
    case 'ok':
      return {
        bg: 'rgba(46, 94, 62, 0.06)',
        border: 'rgba(46, 94, 62, 0.25)',
        fg: '#2E5E3E',
        fgSoft: 'rgba(46, 94, 62, 0.8)',
      };
    case 'info':
    default:
      return {
        bg: 'rgba(26, 46, 31, 0.04)',
        border: 'rgba(26, 46, 31, 0.15)',
        fg: '#1A2E1F',
        fgSoft: 'var(--jrn-text-muted, #6b6f6b)',
      };
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────

const containerStyle = {
  background: 'var(--jrn-surface, #FAF9F6)',
  border: '1px solid rgba(26, 46, 31, 0.10)',
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 16,
  boxShadow: '0 1px 2px rgba(26, 46, 31, 0.04)',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
  gap: 8,
  flexWrap: 'wrap',
};

const eyebrowStyle = {
  fontFamily: 'var(--jrn-font-ui, system-ui)',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--jrn-text-muted, #6b6f6b)',
};

const countPillStyle = {
  fontSize: 10.5,
  color: 'var(--jrn-text-muted, #6b6f6b)',
  background: 'rgba(26, 46, 31, 0.05)',
  padding: '3px 9px',
  borderRadius: 999,
  border: '1px solid rgba(26, 46, 31, 0.08)',
};

const listStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const patternStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid',
};

// P2.1 — encart "synchro échouée" (ton ambre, distinct des patterns cliniques).
const syncErrorBoxStyle = {
  background: 'rgba(184, 134, 38, 0.06)',
  borderColor: 'rgba(184, 134, 38, 0.3)',
};

const patternLabelStyle = {
  fontSize: 12.5,
  fontWeight: 700,
  marginBottom: 4,
};

const patternDetailStyle = {
  fontSize: 11.5,
  lineHeight: 1.45,
};

const patternActionStyle = {
  fontSize: 11.5,
  fontWeight: 600,
  marginTop: 6,
  fontStyle: 'italic',
};
