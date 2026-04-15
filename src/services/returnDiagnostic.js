import { getNutritionConsultations } from '../store';

function getReturnThreshold(consultationCount) {
  if (consultationCount >= 5) return 60;
  if (consultationCount >= 3) return 75;
  return 90;
}

// Détecte si un client est en mode "reprise"
export function isReturnClient(client) {
  const consultations = getNutritionConsultations(client.id);
  if (!consultations.length) return false;
  const threshold = getReturnThreshold(consultations.length);
  const lastDate = new Date(consultations[0].createdAt || consultations[0].date);
  const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > threshold;
}

// Retourne le nombre de jours depuis la dernière consultation
export function daysSinceLastConsultation(client) {
  const consultations = getNutritionConsultations(client.id);
  if (!consultations.length) return null;
  const lastDate = new Date(consultations[0].createdAt || consultations[0].date);
  return Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}

// Construit le diagnostic de reprise basé sur l'historique réel
export function buildReturnDiagnostic(client, cycleReviews = []) {
  const consultations = getNutritionConsultations(client.id);
  const progression = client.progression || [];
  const form = client.form || {};

  // Données brutes
  const lastConsultation = consultations[0] || null;
  const firstConsultation = consultations[consultations.length - 1] || null;
  const lastGoal = form.objectifPrincipalNutrition
    || (form.symptomesObjectifs || []).join(', ')
    || 'Non précisé';

  // Analyse de la progression poids
  let weightTrend = null;
  if (progression.length >= 2) {
    const first = Number(progression[0]?.poids);
    const last = Number(progression[progression.length - 1]?.poids);
    if (!isNaN(first) && !isNaN(last)) {
      const diff = last - first;
      weightTrend = {
        start: first,
        end: last,
        diff: Math.round(diff * 10) / 10,
        direction: diff < -1 ? 'loss' : diff > 1 ? 'gain' : 'stable',
      };
    }
  }

  // Analyse détaillée de la courbe poids
  let weightAnalysis = null;
  if (progression.length >= 2) {
    const weights = progression
      .map(p => ({ date: p.date, kg: Number(p.poids) }))
      .filter(p => !isNaN(p.kg));

    if (weights.length >= 2) {
      const start = weights[0].kg;
      const end = weights[weights.length - 1].kg;
      const peak = Math.max(...weights.map(w => w.kg));
      const trough = Math.min(...weights.map(w => w.kg));
      const totalLoss = start - end;
      const reboundFromTrough = end - trough;

      weightAnalysis = {
        start,
        end,
        totalLoss: Math.round(totalLoss * 10) / 10,
        peak,
        trough,
        reboundFromTrough: Math.round(reboundFromTrough * 10) / 10,
        hasRebound: reboundFromTrough > 1.5,
        isStagnant: Math.abs(totalLoss) < 0.5 && weights.length > 3,
        measureCount: weights.length,
      };
    }
  }

  // Analyse des bilans cycle (ce qui a marché / pas marché)
  const whatWorked = [];
  const whatFailed = [];
  const lastReview = cycleReviews[0] || null;

  if (lastReview) {
    if (lastReview.adherence === '100' || lastReview.adherence === '75') {
      whatWorked.push('Bonne adhérence au plan précédent');
    } else {
      whatFailed.push('Adhérence insuffisante au plan précédent');
    }
    if (lastReview.energy === 'high') {
      whatWorked.push('Bonne énergie sous le plan');
    }
    if (lastReview.digestion === 'bad') {
      whatFailed.push('Problèmes digestifs persistants');
    }
    if (lastReview.difficulty === 'hard' || lastReview.organisation === 'complex') {
      whatFailed.push('Plan jugé trop complexe à suivre');
    }
    if (lastReview.main_issue) {
      const issueLabels = {
        time: 'Manque de temps',
        taste: 'Aliments pas appréciés',
        hunger: 'Faim entre les repas',
        cost: 'Coût alimentaire',
        social: 'Contraintes sociales / restaurants',
        motivation: 'Baisse de motivation',
        complexity: 'Plan trop complexe',
      };
      whatFailed.push(issueLabels[lastReview.main_issue] || lastReview.main_issue);
    }
  }

  // Causes probables de l'arrêt
  const probableCauses = [];
  const days = daysSinceLastConsultation(client);
  if (days > 180) probableCauses.push('Arrêt prolongé (> 6 mois) — remobilisation nécessaire');
  else if (days > 90) probableCauses.push('Pause de 3-6 mois — reprise progressive conseillée');

  if (whatFailed.includes('Plan jugé trop complexe à suivre')) {
    probableCauses.push('Abandon lié à la complexité du plan');
  }
  if (weightTrend?.direction === 'stable' && consultations.length > 1) {
    probableCauses.push('Stagnation des résultats — possible démotivation');
  }
  if (lastReview?.progress === 'none') {
    probableCauses.push('Absence de résultats visibles sur le dernier cycle');
  }

  // Déterminer le profil de reprise
  let returnProfile = 'standard';
  if (whatFailed.includes('Adhérence insuffisante au plan précédent') ||
      whatFailed.includes('Plan jugé trop complexe à suivre')) {
    returnProfile = 'simplify';
  } else if (weightTrend?.direction === 'stable' && consultations.length > 1) {
    returnProfile = 'recalibrate';
  } else if (weightTrend?.direction === 'loss' && lastReview?.progress !== 'yes') {
    returnProfile = 'stabilize';
  } else if (lastReview?.adherence === '100' && lastReview?.progress === 'none') {
    returnProfile = 'metabolic';
  }

  // Affiner le profil avec la courbe poids réelle
  if (weightAnalysis) {
    if (weightAnalysis.hasRebound && weightAnalysis.reboundFromTrough > 3) {
      returnProfile = 'stabilize';
    } else if (weightAnalysis.isStagnant && consultations.length > 2) {
      returnProfile = 'recalibrate';
    } else if (weightAnalysis.totalLoss > 3 && weightAnalysis.hasRebound) {
      returnProfile = 'stabilize';
    }
  }

  // Recommandation principale
  const recommendations = {
    simplify:    'Repartir sur une base simple : 3 repas, peu de préparation, objectif unique.',
    recalibrate: 'Changer d\'approche : revoir les macros, introduire une stratégie de cycling.',
    stabilize:   'Phase de stabilisation 2 semaines, puis relance progressive avec nouveaux objectifs.',
    metabolic:   'Recalibrer les apports caloriques — probable adaptation métabolique.',
    standard:    'Reprise progressive avec les acquis du cycle précédent.',
  };

  // Contexte cycles
  const cycleCount = consultations.length;
  let cycleContext = '';
  if (cycleCount === 1) {
    cycleContext = 'Premier retour — repartir sur des bases solides.';
  } else if (cycleCount === 2) {
    cycleContext = 'Deuxième cycle — identifier ce qui a vraiment bloqué.';
  } else if (cycleCount >= 3) {
    cycleContext = `${cycleCount} cycles au compteur — plan expert, éviter la répétition.`;
  }

  return {
    lastGoal,
    daysSinceLastConsult: days,
    consultationCount: consultations.length,
    previousPlans: consultations.slice(0, 3).map(c => ({
      date: c.createdAt || c.date,
      label: c.label || 'Plan généré',
    })),
    weightTrend,
    weightAnalysis,
    whatWorked,
    whatFailed,
    probableCauses,
    returnProfile,
    recommendation: recommendations[returnProfile],
    lastConsultation,
    cycleContext,
  };
}
