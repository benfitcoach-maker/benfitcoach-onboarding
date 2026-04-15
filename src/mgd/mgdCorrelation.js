// Corrélation symptômes ↔ biomarqueurs
// Ne duplique PAS la logique existante —
// croise detectSymptomsFromForm() + analyzeLabResults()

// Mapping symptôme → biomarqueurs qui le confirment
const SYMPTOM_BIOMARKER_MAP = {
  fatigue: ['low_iron_status', 'low_vitamin_d', 'low_b12', 'low_folates',
            'tsh_high_to_investigate', 'thyroid_axis_to_monitor', 'glycemic_dysregulation'],
  digestion: ['intestinal_inflammation', 'microbiome_dysbiosis'],
  weight_gain: ['insulin_resistance', 'glycemic_dysregulation', 'tsh_high_to_investigate'],
  metabolic: ['insulin_resistance', 'glycemic_dysregulation', 'dyslipidemia'],
  stress: ['adrenal_load', 'low_magnesium'],
  pms_cycle: ['low_iron_status', 'low_vitamin_d', 'low_b12'],
  inflammation: ['systemic_inflammation', 'low_iron_status'],
  thyroid: ['tsh_high_to_investigate', 'tsh_low_to_investigate', 'thyroid_conversion_to_monitor'],
  skin_hair: ['low_iron_status', 'low_zinc', 'low_vitamin_d'],
  sleep: ['adrenal_load', 'low_magnesium', 'glycemic_dysregulation'],
};

// Labels simples sans jargon médical
const SIGNAL_LABELS = {
  low_iron_status:              { label: 'Fer insuffisant', severity: 'high' },
  low_vitamin_d:                { label: 'Vitamine D basse', severity: 'high' },
  low_b12:                      { label: 'B12 insuffisante', severity: 'high' },
  low_folates:                  { label: 'Folates bas', severity: 'medium' },
  glycemic_dysregulation:       { label: 'Glycémie instable', severity: 'high' },
  insulin_resistance:           { label: 'Résistance à l\'insuline', severity: 'high' },
  tsh_high_to_investigate:      { label: 'Thyroïde à surveiller (TSH élevée)', severity: 'high' },
  tsh_low_to_investigate:       { label: 'Thyroïde à surveiller (TSH basse)', severity: 'medium' },
  thyroid_axis_to_monitor:      { label: 'Axe thyroïdien limite', severity: 'medium' },
  thyroid_conversion_to_monitor:{ label: 'Conversion T4→T3 à surveiller', severity: 'medium' },
  systemic_inflammation:        { label: 'Inflammation systémique', severity: 'high' },
  dyslipidemia:                 { label: 'Bilan lipidique perturbé', severity: 'medium' },
  iron_overload:                { label: 'Fer en excès', severity: 'medium' },
  excess_vitamin_d:             { label: 'Vitamine D excessive', severity: 'low' },
  hypoglycemia_tendency:        { label: 'Tendance hypoglycémique', severity: 'medium' },
  low_zinc:                     { label: 'Zinc insuffisant', severity: 'medium' },
  low_magnesium:                { label: 'Magnésium insuffisant', severity: 'medium' },
  adrenal_load:                 { label: 'Charge surrénalienne', severity: 'medium' },
};

const SYMPTOM_LABELS = {
  fatigue: 'Fatigue', digestion: 'Digestion', bloating: 'Ballonnements',
  stress: 'Stress', sleep: 'Sommeil', cravings: 'Fringales',
  inflammation: 'Inflammation', skin_hair: 'Peau / Cheveux',
  weight_gain: 'Surpoids', metabolic: 'Métabolisme',
  female_hormones: 'Hormones', pms_cycle: 'SPM / Cycle',
  thyroid: 'Thyroïde', performance: 'Performance',
};

// Actions simples par signal
const SIGNAL_ACTIONS = {
  low_iron_status:               'Augmenter viandes rouges maigres, légumineuses, épinards. Vitamine C au repas.',
  low_vitamin_d:                 'Poissons gras 3x/sem. Exposition solaire 20 min/jour. Supplément si < 20 ng/mL.',
  low_b12:                       'Viandes, poissons, œufs quotidiennement. Supplément méthylcobalamine si végétarien.',
  low_folates:                   'Légumes verts à feuilles quotidiens. Légumineuses 3x/sem.',
  glycemic_dysregulation:        'Réduire sucres rapides. Protéine + fibre à chaque repas. Pas de glucides seuls.',
  insulin_resistance:            'Réduire glucides raffinés. Augmenter fibres et protéines. Marche après repas.',
  tsh_high_to_investigate:       'Éviter excès iode. Sélénium alimentaire (noix du Brésil). Suivi médical conseillé.',
  tsh_low_to_investigate:        'Suivi médical conseillé. Éviter stimulants excessifs.',
  thyroid_axis_to_monitor:       'Sélénium, zinc, iode en quantités adéquates. Éviter soja en excès.',
  thyroid_conversion_to_monitor: 'Sélénium (noix du Brésil 2/jour). Réduire stress chronique.',
  systemic_inflammation:         'Augmenter oméga-3 (poissons gras, graines de lin). Réduire sucres et ultra-transformés.',
  dyslipidemia:                  'Réduire graisses saturées. Augmenter fibres solubles (avoine, légumineuses).',
  iron_overload:                 'Éviter suppléments de fer. Réduire viande rouge. Donner son sang si applicable.',
  hypoglycemia_tendency:         'Augmenter fréquence des repas. Protéine à chaque prise alimentaire.',
  low_zinc:                      'Huîtres, viande, graines de courge, légumineuses.',
  low_magnesium:                 'Légumes verts, amandes, graines de courge, chocolat noir 70%+.',
};

function computePriority(symptom, confirmedSignals) {
  const highSeveritySignals = confirmedSignals.filter(s =>
    SIGNAL_LABELS[s]?.severity === 'high'
  );
  if (highSeveritySignals.length >= 1) return 'high';

  const mediumSignals = confirmedSignals.filter(s =>
    SIGNAL_LABELS[s]?.severity === 'medium'
  );
  if (mediumSignals.length >= 1) return 'medium';

  return 'watch';
}

/**
 * Fonction principale — croise symptômes + résultats biologiques
 * Ne fait PAS de diagnostic médical — signaux nutritionnels uniquement
 */
export function buildMGDCorrelation(symptoms = [], labSignals = []) {
  const correlations = [];
  const alerts = [];
  const recommendations = new Set();

  const alertSignalsSeen = new Set();
  for (const symptom of symptoms) {
    const relatedSignals = SYMPTOM_BIOMARKER_MAP[symptom] || [];
    const confirmedSignals = relatedSignals.filter(s => labSignals.includes(s));

    if (confirmedSignals.length > 0) {
      correlations.push({
        symptom,
        symptomLabel: SYMPTOM_LABELS[symptom] || symptom,
        priority: computePriority(symptom, confirmedSignals),
        confirmedBy: confirmedSignals.map(s => ({
          signal: s,
          label: SIGNAL_LABELS[s]?.label || s,
          severity: SIGNAL_LABELS[s]?.severity || 'medium',
        })),
      });

      // Alertes pour signaux sévères (dédupliquées)
      for (const s of confirmedSignals) {
        if (SIGNAL_LABELS[s]?.severity === 'high' && !alertSignalsSeen.has(s)) {
          alertSignalsSeen.add(s);
          alerts.push({
            signal: s,
            label: SIGNAL_LABELS[s].label,
            action: SIGNAL_ACTIONS[s] || '',
          });
        }
        if (SIGNAL_ACTIONS[s]) recommendations.add(SIGNAL_ACTIONS[s]);
      }
    }
  }

  // Signaux biologiques sans corrélation symptôme déclaré
  const uncorrelatedSignals = labSignals.filter(s =>
    !correlations.some(c => c.confirmedBy.some(b => b.signal === s))
  );

  // Trier par priorité
  const priorityOrder = { high: 0, medium: 1, watch: 2 };
  correlations.sort((a, b) =>
    (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  );

  // Résumé clinique — problème principal + lien + priorité
  const topCorrelation = correlations[0] || null;
  const clinicalSummary = topCorrelation ? {
    mainIssue: topCorrelation.symptomLabel,
    confirmedBy: topCorrelation.confirmedBy.map(b => b.label).join(', '),
    priority: topCorrelation.priority,
    topAction: alerts[0]?.action || '',
  } : null;

  return {
    correlations,           // symptôme confirmé par biomarqueur
    alerts,                 // signaux sévères avec action
    recommendations: [...recommendations].slice(0, 5),
    uncorrelatedSignals,    // signaux bio sans symptôme déclaré (à signaler)
    hasCorrelations: correlations.length > 0,
    hasCritical: alerts.some(a => SIGNAL_LABELS[a.signal]?.severity === 'high'),
    clinicalSummary,        // résumé prioritaire pour affichage rapide
  };
}

/**
 * Formate la corrélation pour injection dans le prompt IA
 */
export function formatCorrelationForPrompt(correlation) {
  if (!correlation.hasCorrelations && correlation.alerts.length === 0) return '';

  const lines = ['--- CORRÉLATIONS BIOLOGIQUES CONFIRMÉES ---'];

  for (const c of correlation.correlations) {
    lines.push(`${c.symptomLabel} : confirmé par ${c.confirmedBy.map(b => b.label).join(', ')}`);
  }

  if (correlation.alerts.length > 0) {
    lines.push('');
    lines.push('Priorités nutritionnelles :');
    for (const a of correlation.alerts) {
      lines.push(`- ${a.label} : ${a.action}`);
    }
  }

  if (correlation.uncorrelatedSignals.length > 0) {
    const labels = correlation.uncorrelatedSignals
      .map(s => SIGNAL_LABELS[s]?.label || s)
      .join(', ');
    lines.push('');
    lines.push(`Signaux biologiques sans symptôme déclaré : ${labels}`);
  }

  return lines.join('\n');
}
