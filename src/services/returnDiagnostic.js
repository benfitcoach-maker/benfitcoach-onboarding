import { getNutritionConsultations } from '../store';

const RETURN_THRESHOLD_DAYS = 1; // TODO: remettre à 90 après test

// Détecte si un client est en mode "reprise"
export function isReturnClient(client) {
  const consultations = getNutritionConsultations(client.id);
  if (!consultations.length) return false;
  const lastDate = new Date(consultations[0].createdAt || consultations[0].date);
  const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > RETURN_THRESHOLD_DAYS;
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
    returnProfile = 'simplify'; // simplifier fortement
  } else if (weightTrend?.direction === 'stable' && consultations.length > 1) {
    returnProfile = 'recalibrate'; // changer de stratégie
  } else if (weightTrend?.direction === 'loss' && lastReview?.progress !== 'yes') {
    returnProfile = 'stabilize'; // stabilisation + relance
  } else if (lastReview?.adherence === '100' && lastReview?.progress === 'none') {
    returnProfile = 'metabolic'; // ajustement métabolique
  }

  // Recommandation principale
  const recommendations = {
    simplify:    'Repartir sur une base simple : 3 repas, peu de préparation, objectif unique.',
    recalibrate: 'Changer d\'approche : revoir les macros, introduire une stratégie de cycling.',
    stabilize:   'Phase de stabilisation 2 semaines, puis relance progressive avec nouveaux objectifs.',
    metabolic:   'Recalibrer les apports caloriques — probable adaptation métabolique.',
    standard:    'Reprise progressive avec les acquis du cycle précédent.',
  };

  return {
    lastGoal,
    daysSinceLastConsult: days,
    consultationCount: consultations.length,
    previousPlans: consultations.slice(0, 3).map(c => ({
      date: c.createdAt || c.date,
      label: c.label || 'Plan généré',
    })),
    weightTrend,
    whatWorked,
    whatFailed,
    probableCauses,
    returnProfile,
    recommendation: recommendations[returnProfile],
    lastConsultation,
  };
}
