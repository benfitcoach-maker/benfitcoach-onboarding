// V94.28 : extrait depuis NutritionConsultation.jsx (Phase 1.C refactor)
// Persistance localStorage des signaux d'apprentissage IA :
// - chaque generation de plan est tracee (initial score, final score, auto-correction)
// - retro-analyse via getLearningInsights pour ajuster les prompts dans le temps

const LEARNING_LOG_KEY = 'bfc_nutrition_learning';

/**
 * Construit un signal d'apprentissage a partir du contexte d'une generation.
 * @returns objet pret a etre stocke (50 derniers conserves)
 */
export function buildLearningSignal(form, { isFollowup, followupWeek, initialScore, finalScore, autoCorrected }) {
  return {
    timestamp: new Date().toISOString(),
    isFollowup,
    followupWeek: followupWeek || null,
    profile: {
      hasAllergies: !!(form?.allergies || '').trim(),
      hasPathologies: !!(form?.pathologies || '').trim(),
      hasSport: !!(form?.frequenceSport && form.frequenceSport !== 'Jamais'),
      hasSupplements: form?.pretProtocole === 'Oui' || form?.pretProtocole === 'Peut-etre',
      formule: form?._clientFormule || null,
    },
    initialScore: initialScore ? {
      normalized: initialScore.normalized,
      coherence: initialScore.coherence,
      simplicity: initialScore.simplicity,
      applicability: initialScore.applicability,
      constraints: initialScore.constraints,
      hasHardFail: initialScore.hasHardFail,
      hardFails: initialScore.hardFails,
      penalties: initialScore.penalties,
    } : null,
    finalScore: finalScore ? {
      normalized: finalScore.normalized,
      coherence: finalScore.coherence,
      simplicity: finalScore.simplicity,
      applicability: finalScore.applicability,
      constraints: finalScore.constraints,
      hasHardFail: finalScore.hasHardFail,
      hardFails: finalScore.hardFails,
      penalties: finalScore.penalties,
    } : null,
    autoCorrected,
  };
}

/**
 * Persiste un signal en localStorage. Garde les 50 derniers, silent si quota plein.
 */
export function saveLearningSignal(signal) {
  try {
    const logs = JSON.parse(localStorage.getItem(LEARNING_LOG_KEY) || '[]');
    logs.push(signal);
    // Keep last 50 entries
    if (logs.length > 50) logs.splice(0, logs.length - 50);
    localStorage.setItem(LEARNING_LOG_KEY, JSON.stringify(logs));
  } catch { /* silent */ }
}

/**
 * Aggrege tous les signaux pour un dashboard insights :
 * - taux auto-correction
 * - taux hard fail initial vs final
 * - top 5 penalties
 * - patterns profil dans les corrections
 * - scores moyens
 * @returns null si aucun signal, sinon objet d'insights
 */
export function getLearningInsights() {
  try {
    const logs = JSON.parse(localStorage.getItem(LEARNING_LOG_KEY) || '[]');
    if (logs.length === 0) return null;

    const total = logs.length;
    const autoCorrectedCount = logs.filter(l => l.autoCorrected).length;
    const initialHardFailCount = logs.filter(l => l.initialScore?.hasHardFail).length;
    const finalHardFailCount = logs.filter(l => l.finalScore?.hasHardFail).length;

    // Top penalties (flatten + count)
    const penaltyCounts = {};
    for (const log of logs) {
      for (const p of (log.initialScore?.penalties || [])) {
        penaltyCounts[p] = (penaltyCounts[p] || 0) + 1;
      }
    }
    const topPenalties = Object.entries(penaltyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([penalty, count]) => ({ penalty, count, pct: Math.round((count / total) * 100) }));

    // Average scores
    const avgInitial = logs.reduce((s, l) => s + (l.initialScore?.normalized || 0), 0) / total;
    const avgFinal = logs.reduce((s, l) => s + (l.finalScore?.normalized || l.initialScore?.normalized || 0), 0) / total;

    // Profile patterns in corrections
    const correctedLogs = logs.filter(l => l.autoCorrected);
    const profilePatterns = {};
    for (const log of correctedLogs) {
      const p = log.profile;
      if (p.hasAllergies) profilePatterns['allergies'] = (profilePatterns['allergies'] || 0) + 1;
      if (p.hasPathologies) profilePatterns['pathologies'] = (profilePatterns['pathologies'] || 0) + 1;
      if (p.hasSport) profilePatterns['sport'] = (profilePatterns['sport'] || 0) + 1;
    }

    return {
      total,
      autoCorrectionRate: Math.round((autoCorrectedCount / total) * 100),
      initialHardFailRate: Math.round((initialHardFailCount / total) * 100),
      finalHardFailRate: Math.round((finalHardFailCount / total) * 100),
      avgScoreInitial: Math.round(avgInitial * 10) / 10,
      avgScoreFinal: Math.round(avgFinal * 10) / 10,
      topPenalties,
      profilePatterns,
    };
  } catch { return null; }
}
