// ─── feedbackTrends ────────────────────────────────────────────────────
// Transforme les feedbacks bruts d'une cliente (7 derniers jours) en
// tendance par axe + statut global. Vue "agrégée et actionnable" pour
// Anissa, à interpréter comme une tendance — pas comme un jour isolé.
//
// Statuts par axe :
//   - stable  : majorité positive/neutre, peu/pas de signal négatif
//   - watch   : signal mixte, peu de données, à surveiller
//   - adjust  : majorité négative OU 2 jours négatifs consécutifs
//
// Statut global = pire statut parmi les 4 axes (adjust > watch > stable).
//
// Axes : fatigue / digestion / faim / energie
// (les valeurs varient selon l'axe — voir AXIS_VALUE_KIND).
//
// Fonction pure : pas de side effect, pas d'IA, pas de fetch.

const AXIS_VALUE_KIND = {
  fatigue:   { positive: ['better'],     neutral: ['same'], negative: ['worse'] },
  digestion: { positive: ['better'],     neutral: ['same'], negative: ['worse'] },
  faim:      { positive: ['ok'],         neutral: [],       negative: ['low', 'high'] },
  energie:   { positive: ['good', 'ok'], neutral: [],       negative: ['low'] },
};

const AXIS_LABELS = {
  fatigue:   'Fatigue',
  digestion: 'Digestion',
  faim:      'Faim',
  energie:   'Énergie',
};

const STATUS_LABELS = {
  stable: 'Stable',
  watch:  'À surveiller',
  adjust: 'Tendance à ajuster',
};

function getKindForAxisValue(axis, value) {
  if (!value) return null;
  const config = AXIS_VALUE_KIND[axis];
  if (!config) return null;
  if (config.positive.includes(value)) return 'positive';
  if (config.neutral.includes(value))  return 'neutral';
  if (config.negative.includes(value)) return 'negative';
  return null;
}

// Cherche une série de N feedbacks consécutifs négatifs sur l'axe.
// Les feedbacks doivent être triés par date croissante avant d'être passés ici.
function hasConsecutiveNegative(axis, feedbacks, minCount = 2) {
  let streak = 0;
  for (const feedback of feedbacks) {
    const kind = getKindForAxisValue(axis, feedback?.[axis]);
    if (kind === 'negative') {
      streak += 1;
      if (streak >= minCount) return true;
    } else if (kind !== null) {
      // Reset uniquement sur valeur connue (positive/neutre).
      // Une valeur null/inconnue ne casse pas la série.
      streak = 0;
    }
  }
  return false;
}

function buildAxisSummary(axis, status, _counts, total) {
  const label = AXIS_LABELS[axis] || axis;
  if (total === 0)          return `${label} : pas encore assez de données.`;
  if (status === 'stable')  return `${label} : tendance stable sur les derniers retours.`;
  if (status === 'adjust')  return `${label} : tendance à ajuster sur plusieurs retours.`;
  return `${label} : signal à surveiller sur les derniers retours.`;
}

export function computeAxisTrend(axis, feedbacks = []) {
  const values = feedbacks.map((f) => f?.[axis]).filter(Boolean);
  const total = values.length;

  if (total === 0) {
    return {
      axis,
      label: AXIS_LABELS[axis] || axis,
      status: 'watch',
      statusLabel: STATUS_LABELS.watch,
      summary: `${AXIS_LABELS[axis] || axis} : pas encore assez de données.`,
      counts: { positive: 0, neutral: 0, negative: 0, total: 0 },
    };
  }

  const counts = values.reduce(
    (acc, value) => {
      const kind = getKindForAxisValue(axis, value);
      if (kind) acc[kind] += 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );

  const negativeRatio = counts.negative / total;
  const positiveOrNeutralRatio = (counts.positive + counts.neutral) / total;
  const consecutiveNegative = hasConsecutiveNegative(axis, feedbacks, 2);

  let status = 'watch';
  if (total <= 2) {
    // Trop peu de données pour un diagnostic fort
    status = counts.negative >= 1 ? 'watch' : 'stable';
  } else if (negativeRatio >= 0.5 || consecutiveNegative) {
    status = 'adjust';
  } else if (positiveOrNeutralRatio >= 0.6 && counts.negative === 0) {
    status = 'stable';
  } else if (positiveOrNeutralRatio >= 0.6 && counts.negative <= 1) {
    status = 'stable';
  } else {
    status = 'watch';
  }

  return {
    axis,
    label: AXIS_LABELS[axis] || axis,
    status,
    statusLabel: STATUS_LABELS[status],
    summary: buildAxisSummary(axis, status, counts, total),
    counts: { ...counts, total },
  };
}

export function computeFeedbackTrends(feedbacks = []) {
  // Tri ASC pour que hasConsecutiveNegative ait un sens chronologique.
  const sortedFeedbacks = [...feedbacks].sort((a, b) => {
    const da = new Date(a.date || a.created_at || 0).getTime();
    const db = new Date(b.date || b.created_at || 0).getTime();
    return da - db;
  });

  const axes = ['fatigue', 'digestion', 'faim', 'energie'];
  const axisTrends = axes.map((axis) => computeAxisTrend(axis, sortedFeedbacks));

  const hasAdjust = axisTrends.some((t) => t.status === 'adjust');
  const hasWatch  = axisTrends.some((t) => t.status === 'watch');
  const dataPoints = sortedFeedbacks.length;

  let globalStatus = 'stable';
  let globalLabel = STATUS_LABELS.stable;
  if (hasAdjust) {
    globalStatus = 'adjust';
    globalLabel = STATUS_LABELS.adjust;
  } else if (hasWatch || dataPoints <= 2) {
    globalStatus = 'watch';
    globalLabel = STATUS_LABELS.watch;
  }

  return {
    dataPoints,
    globalStatus,
    globalLabel,
    axisTrends,
  };
}

// Réexports pour consommation côté UI
export { STATUS_LABELS, AXIS_LABELS };
