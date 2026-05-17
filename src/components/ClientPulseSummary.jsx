// ─── ClientPulseSummary ────────────────────────────────────────────────
// V97.17.12 — Bloc 'Pouls de la cliente' pour la page Suivi etape 8.
//
// Agrege les chips cliniques des 3 dernieres consultations pour donner
// a Anissa un coup d'oeil immediat sur l'evolution clinique sans avoir
// a relire chaque consult individuellement.
//
// Pour chaque dimension (digestion/energy/sleep/transit/stress +
// alimentation/supplements adherence), affiche :
//   - La valeur la plus recente
//   - Une fleche d'evolution vs la consult precedente (si dispo)
//
// Si < 1 consult avec clinical → null (rien a afficher).

import { useMemo } from 'react';

const SYMPTOM_DIMS = [
  { key: 'digestion', label: 'Digestion' },
  { key: 'energy',    label: 'Energie' },
  { key: 'sleep',     label: 'Sommeil' },
  { key: 'transit',   label: 'Transit' },
  { key: 'stress',    label: 'Stress' },
];

const ADHERENCE_DIMS = [
  { key: 'food',        label: 'Alimentation' },
  { key: 'supplements', label: 'Supplements' },
];

// Mapping valeur → score pour comparaison ordinale
const SYMPTOM_SCORE = { good: 2, mixed: 1, bad: 0 };
const ADHERENCE_SCORE = { good: 2, partial: 1, low: 0 };

const SYMPTOM_LABELS = {
  good:  { label: 'OK',        tone: 'ok' },
  mixed: { label: 'mitige',    tone: 'mixed' },
  bad:   { label: 'difficile', tone: 'bad' },
};

const ADHERENCE_LABELS = {
  good:    { label: 'suivi',   tone: 'ok' },
  partial: { label: 'partiel', tone: 'mixed' },
  low:     { label: 'faible',  tone: 'bad' },
};

function toneColor(tone) {
  switch (tone) {
    case 'ok':    return { bg: 'rgba(46, 94, 62, 0.10)',   fg: '#2E5E3E' };
    case 'mixed': return { bg: 'rgba(184, 134, 38, 0.10)', fg: '#785a1a' };
    case 'bad':   return { bg: 'rgba(160, 64, 64, 0.08)',  fg: '#a04040' };
    default:      return { bg: 'rgba(26, 46, 31, 0.04)',   fg: '#1A2E1F' };
  }
}

function trendArrow(curScore, prevScore) {
  if (prevScore == null) return null;
  if (curScore > prevScore) return { sym: '↗', color: '#2E5E3E', label: 'amelioration' };
  if (curScore < prevScore) return { sym: '↘', color: '#a04040', label: 'degradation' };
  return { sym: '→', color: '#8a8a7a', label: 'stable' };
}

export default function ClientPulseSummary({ consultationsLog }) {
  // Filter and reverse : on prend les consults avec clinical, plus recentes d'abord
  const recentClinical = useMemo(() => {
    if (!Array.isArray(consultationsLog) || consultationsLog.length === 0) return [];
    return [...consultationsLog]
      .reverse()
      .filter((c) => c?.clinical && typeof c.clinical === 'object')
      .slice(0, 3);
  }, [consultationsLog]);

  if (recentClinical.length === 0) return null;

  const latest = recentClinical[0];
  const previous = recentClinical[1] || null;

  // Compute dimensions to display : symptomes + adherence
  function buildRows(dims, mapValues, scoreMap) {
    return dims
      .map((dim) => {
        const curVal = latest?.clinical?.[
          dims === SYMPTOM_DIMS ? 'symptoms' : 'adherence'
        ]?.[dim.key];
        if (!curVal) return null;
        const prevVal = previous?.clinical?.[
          dims === SYMPTOM_DIMS ? 'symptoms' : 'adherence'
        ]?.[dim.key];
        const curMeta = mapValues[curVal];
        if (!curMeta) return null;
        const trend = prevVal && scoreMap[prevVal] != null
          ? trendArrow(scoreMap[curVal], scoreMap[prevVal])
          : null;
        return { dim, curMeta, trend };
      })
      .filter(Boolean);
  }

  const symptomRows = buildRows(SYMPTOM_DIMS, SYMPTOM_LABELS, SYMPTOM_SCORE);
  const adherenceRows = buildRows(ADHERENCE_DIMS, ADHERENCE_LABELS, ADHERENCE_SCORE);

  const hasAny = symptomRows.length > 0 || adherenceRows.length > 0;
  if (!hasAny) return null;

  const latestDate = latest.date
    ? new Date(latest.date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
    : '';
  const prevDate = previous?.date
    ? new Date(previous.date).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
    : null;

  return (
    <div className="jrn-block">
      <div className="jrn-block__head">
        <span className="jrn-block__num">2</span>
        <h3 className="jrn-block__title">Pouls clinique</h3>
        <span style={metaPillStyle}>
          {recentClinical.length} consult{recentClinical.length > 1 ? 's' : ''} recente{recentClinical.length > 1 ? 's' : ''}
        </span>
      </div>
      <p className="jrn-block__intro">
        Synthese des chips renseignes sur les {recentClinical.length} dernieres
        consultations. La fleche compare la plus recente ({latestDate})
        {prevDate ? ` a la precedente (${prevDate})` : ' uniquement'}.
      </p>

      <div style={listStyle}>
        {symptomRows.length > 0 && (
          <div style={groupStyle}>
            <div style={groupLabelStyle}>Symptomes</div>
            <div style={chipsGridStyle}>
              {symptomRows.map(({ dim, curMeta, trend }) => {
                const col = toneColor(curMeta.tone);
                return (
                  <div
                    key={dim.key}
                    style={{ ...chipStyle, background: col.bg, color: col.fg }}
                    title={trend ? `${trend.label} vs derniere consult` : 'aucune comparaison'}
                  >
                    <span style={chipDimStyle}>{dim.label}</span>
                    <span style={chipValStyle}>{curMeta.label}</span>
                    {trend && (
                      <span style={{ ...trendArrowStyle, color: trend.color }}>{trend.sym}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {adherenceRows.length > 0 && (
          <div style={groupStyle}>
            <div style={groupLabelStyle}>Adherence</div>
            <div style={chipsGridStyle}>
              {adherenceRows.map(({ dim, curMeta, trend }) => {
                const col = toneColor(curMeta.tone);
                return (
                  <div
                    key={dim.key}
                    style={{ ...chipStyle, background: col.bg, color: col.fg }}
                    title={trend ? `${trend.label} vs derniere consult` : 'aucune comparaison'}
                  >
                    <span style={chipDimStyle}>{dim.label}</span>
                    <span style={chipValStyle}>{curMeta.label}</span>
                    {trend && (
                      <span style={{ ...trendArrowStyle, color: trend.color }}>{trend.sym}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const metaPillStyle = {
  marginLeft: 'auto',
  fontSize: 10.5,
  color: 'var(--jrn-text-muted, #6b6f6b)',
  background: 'rgba(26, 46, 31, 0.05)',
  padding: '3px 9px',
  borderRadius: 999,
  border: '1px solid rgba(26, 46, 31, 0.08)',
  letterSpacing: '.02em',
};

const listStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  marginTop: 8,
};

const groupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const groupLabelStyle = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--jrn-text-muted, #6b6f6b)',
};

const chipsGridStyle = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11.5,
  padding: '5px 10px',
  borderRadius: 999,
  fontWeight: 500,
  fontFamily: 'var(--jrn-font-ui, system-ui)',
};

const chipDimStyle = {
  fontWeight: 600,
};

const chipValStyle = {
  opacity: 0.75,
  fontWeight: 400,
};

const trendArrowStyle = {
  fontSize: 13,
  fontWeight: 700,
  marginLeft: 2,
};
