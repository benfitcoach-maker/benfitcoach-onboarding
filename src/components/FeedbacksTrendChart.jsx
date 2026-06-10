// ─── FeedbacksTrendChart ────────────────────────────────────────────────
// V97.17.21 — Mini sparklines des ressentis cliente sur 30 jours.
//
// Complete ClinicalAlertBanner (V97.17.20) : au-dela des patterns
// detectes, Anissa voit visuellement la tendance par dimension.
// 3 dimensions affichees : Digestion, Fatigue, Energie. Faim moins
// prioritaire pour cette V1.
//
// Mapping valeur → score (0 a 1) :
//   - 'better' / 'good' = 1.0 (haut = bon)
//   - 'same' / 'ok'     = 0.5
//   - 'worse' / 'low'   = 0.0
//
// SVG ultra leger, sans dependance externe. Si < 3 ressentis → masque.

import { useMemo } from 'react';

const DIMS = [
  {
    key: 'digestion',
    label: 'Digestion',
    color: '#2E5E3E',
    map: { better: 1, same: 0.5, worse: 0 },
  },
  {
    key: 'fatigue',
    label: 'Fatigue (Mieux=haut, Pire=bas)',
    color: '#785a1a',
    map: { better: 1, same: 0.5, worse: 0 },
  },
  {
    key: 'energie',
    label: 'Energie',
    color: '#1A2E1F',
    map: { good: 1, ok: 0.5, low: 0 },
  },
];

const WINDOW_DAYS = 30;
const MIN_DATA_POINTS = 3;

export default function FeedbacksTrendChart({ feedbacks, syncError = false }) {
  // Trie chronologique ascendant (vieux a gauche, recent a droite)
  const sortedFeedbacks = useMemo(() => {
    if (!Array.isArray(feedbacks) || feedbacks.length === 0) return [];
    return [...feedbacks]
      .filter((f) => f.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-WINDOW_DAYS);
  }, [feedbacks]);

  // P2.1 — sous panne synchro, ne pas disparaître en silence (« pas de
  // tendance » alors qu'on ne sait pas) : afficher un état distinct.
  if (syncError) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={eyebrowStyle}>Tendances ressentis</span>
        </div>
        <p style={{ ...rowEmptyTextStyle, color: '#785a1a', margin: 0 }}>
          Tendances indisponibles — synchro app cliente échouée.
        </p>
      </div>
    );
  }

  if (sortedFeedbacks.length < MIN_DATA_POINTS) return null;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={eyebrowStyle}>Tendances ressentis</span>
        <span style={countPillStyle}>
          {sortedFeedbacks.length} ressenti{sortedFeedbacks.length > 1 ? 's' : ''} sur 30 jours
        </span>
      </div>

      <div style={chartsListStyle}>
        {DIMS.map((dim) => (
          <SparklineRow
            key={dim.key}
            label={dim.label}
            color={dim.color}
            data={sortedFeedbacks
              .map((f) => dim.map[f[dim.key]])
              .filter((v) => typeof v === 'number')}
          />
        ))}
      </div>
    </div>
  );
}

function SparklineRow({ label, color, data }) {
  if (!data || data.length < MIN_DATA_POINTS) {
    return (
      <div style={rowEmptyStyle}>
        <span style={rowLabelStyle}>{label}</span>
        <span style={rowEmptyTextStyle}>donnees insuffisantes</span>
      </div>
    );
  }

  // SVG path : 0..1 maps to viewBox 0..40 (top), x = uniform spread
  const VB_W = 100;
  const VB_H = 30;
  const stepX = data.length > 1 ? VB_W / (data.length - 1) : 0;
  const pointsToPath = (pts) =>
    pts
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)},${(VB_H - v * VB_H).toFixed(2)}`)
      .join(' ');

  const lastValue = data[data.length - 1];
  const prevValue = data.length > 1 ? data[data.length - 2] : null;
  const trend = prevValue == null
    ? null
    : lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'flat';

  return (
    <div style={rowStyle}>
      <div style={rowHeadStyle}>
        <span style={rowLabelStyle}>{label}</span>
        {trend && (
          <span style={{ ...trendStyle, color: trendColor(trend, color) }}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
          </span>
        )}
      </div>
      <svg
        width="100%"
        height="30"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={svgStyle}
        aria-hidden
      >
        {/* Ligne mediane 0.5 */}
        <line
          x1="0"
          y1={VB_H * 0.5}
          x2={VB_W}
          y2={VB_H * 0.5}
          stroke="rgba(26,46,31,0.08)"
          strokeWidth="0.5"
          strokeDasharray="2 2"
        />
        {/* Sparkline */}
        <path
          d={pointsToPath(data)}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Dot dernier point */}
        <circle
          cx={(data.length - 1) * stepX}
          cy={VB_H - lastValue * VB_H}
          r="2"
          fill={color}
        />
      </svg>
    </div>
  );
}

function trendColor(trend, baseColor) {
  if (trend === 'up') return '#2E5E3E';
  if (trend === 'down') return '#a04040';
  return 'var(--jrn-text-muted, #6b6f6b)';
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

const chartsListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const rowStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const rowEmptyStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 0',
  fontSize: 11,
};

const rowHeadStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const rowLabelStyle = {
  fontSize: 11,
  color: '#1A2E1F',
  fontWeight: 500,
};

const rowEmptyTextStyle = {
  fontSize: 10.5,
  color: 'var(--jrn-text-muted, #6b6f6b)',
  fontStyle: 'italic',
};

const trendStyle = {
  fontSize: 13,
  fontWeight: 700,
};

const svgStyle = {
  display: 'block',
  width: '100%',
};
