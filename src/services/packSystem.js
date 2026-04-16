// ─── PACK DEFINITIONS ───────────────────────────────────────────

export const PACK_DEFINITIONS = {
  oneshot_180: {
    label: 'Bilan Nutritionnel',
    price: 180,
    durationWeeks: 0,
    consultations: 1,
    steps: [],
    requiresBloodwork: false,
    requiresDna: false,
  },
  oneshot_280: {
    label: 'Bilan Sanguin',
    price: 280,
    durationWeeks: 0,
    consultations: 1,
    steps: [],
    requiresBloodwork: true,
    requiresDna: false,
  },
  oneshot_750: {
    label: 'Nutrition ADN',
    price: 750,
    durationWeeks: 0,
    consultations: 1,
    steps: [],
    requiresBloodwork: true,
    requiresDna: true,
  },
  suivi_3m: {
    label: 'Suivi Essentiel 3 mois',
    price: 490,
    durationWeeks: 12,
    consultations: 2,
    requiresBloodwork: false,
    requiresDna: false,
    steps: [
      { weekOffset: 4,  type: 'review',       label: 'Bilan S4 — Adhérence',         template: 'adherence' },
      { weekOffset: 8,  type: 'consultation',  label: 'Consultation mi-parcours',      template: null },
      { weekOffset: 12, type: 'review',        label: 'Bilan final',                   template: 'final' },
    ],
  },
  suivi_6m: {
    label: 'Suivi Complet 6 mois',
    price: 850,
    durationWeeks: 24,
    consultations: 4,
    requiresBloodwork: true,
    requiresDna: false,
    steps: [
      { weekOffset: 4,  type: 'review',       label: 'Bilan S4 — Adhérence',         template: 'adherence' },
      { weekOffset: 8,  type: 'review',       label: 'Bilan S8 — Résultats',         template: 'results' },
      { weekOffset: 12, type: 'consultation', label: 'Consultation mi-parcours',      template: null },
      { weekOffset: 16, type: 'review',       label: 'Bilan S16 — Métabolique',      template: 'metabolic' },
      { weekOffset: 24, type: 'review',       label: 'Bilan final',                  template: 'final' },
    ],
  },
  suivi_adn: {
    label: 'Suivi ADN & Longévité',
    price: 1490,
    durationWeeks: 24,
    consultations: 6,
    requiresBloodwork: true,
    requiresDna: true,
    steps: [
      { weekOffset: 2,  type: 'bloodwork',   label: 'Bilan sanguin MGD',            template: null },
      { weekOffset: 4,  type: 'review',      label: 'Bilan S4 — Adhérence',         template: 'adherence' },
      { weekOffset: 6,  type: 'dna',         label: 'Résultats ADN à saisir',       template: null },
      { weekOffset: 8,  type: 'review',      label: 'Bilan S8 — Résultats',         template: 'results' },
      { weekOffset: 12, type: 'consultation',label: 'Consultation ADN + plan',      template: null },
      { weekOffset: 16, type: 'review',      label: 'Bilan S16 — Métabolique',      template: 'metabolic' },
      { weekOffset: 20, type: 'consultation',label: 'Consultation optimisation',    template: null },
      { weekOffset: 24, type: 'review',      label: 'Bilan final longévité',        template: 'final' },
    ],
  },
};

// ─── TEMPLATE QUESTIONS PAR ÉTAPE ───────────────────────────────

export const REVIEW_TEMPLATES = {
  adherence: {
    label: 'Bilan d\'adhérence',
    description: 'Évaluation de l\'adhérence au plan et du ressenti général',
    fields: ['adherence', 'energy', 'digestion', 'difficulty', 'organisation', 'main_issue'],
  },
  results: {
    label: 'Bilan résultats',
    description: 'Évaluation des résultats visibles et des blocages rencontrés',
    fields: ['adherence', 'progress', 'energy', 'digestion', 'cheats', 'main_issue'],
  },
  metabolic: {
    label: 'Bilan métabolique',
    description: 'Adaptation métabolique et ajustements nécessaires',
    fields: ['adherence', 'progress', 'energy', 'digestion', 'difficulty', 'main_issue'],
  },
  final: {
    label: 'Bilan final',
    description: 'Bilan de clôture du programme',
    fields: ['adherence', 'progress', 'energy', 'digestion', 'cheats', 'difficulty', 'main_issue'],
  },
};

// ─── CALCUL DU PLANNING DE SUIVI ────────────────────────────────

/**
 * Calcule les étapes de suivi pour un client selon son pack.
 * Retourne un tableau d'étapes avec dates calculées et statuts.
 */
export function buildPackFollowupSchedule(client) {
  const packType = client.packType || 'oneshot_180';
  const pack = PACK_DEFINITIONS[packType];
  if (!pack || pack.steps.length === 0) return [];

  // Règle : pack_started_at = première consultation réelle
  // Fallback : pack_started_at stocké → sinon createdAt
  const resolveStartDate = (c) => {
    if (c.packStartedAt) {
      const stored = new Date(c.packStartedAt);
      const created = new Date(c.createdAt || Date.now());
      // packStartedAt valide = même jour ou postérieur à createdAt
      if (stored >= created) return stored;
    }
    return new Date(c.createdAt || Date.now());
  };
  const startedAt = resolveStartDate(client);

  const packSchedule = client.packSchedule || [];

  return pack.steps.map((step, idx) => {
    const dueDate = new Date(startedAt);
    dueDate.setDate(dueDate.getDate() + step.weekOffset * 7);

    const existing = packSchedule.find(s => s.stepNumber === idx + 1) || {};
    const now = new Date();
    const isLate = dueDate < now && existing.status !== 'done';
    const isDueSoon = !isLate && (dueDate - now) / (1000 * 60 * 60 * 24) <= 7;

    return {
      stepNumber: idx + 1,
      weekOffset: step.weekOffset,
      type: step.type,
      label: step.label,
      template: step.template,
      dueDate: dueDate.toISOString(),
      status: existing.status || (isLate ? 'late' : 'pending'),
      isLate,
      isDueSoon,
      reviewId: existing.reviewId || null,
      completedAt: existing.completedAt || null,
      notifiedAt: existing.notifiedAt || null,
    };
  });
}

/**
 * Retourne la prochaine étape à traiter pour un client.
 * Une seule étape active = première non done, triée par weekOffset.
 */
export function getNextPendingStep(client) {
  const steps = buildPackFollowupSchedule(client);
  return steps
    .filter(s => s.status !== 'done')
    .sort((a, b) => a.weekOffset - b.weekOffset)[0] || null;
}

/**
 * Détermine si le bouton "Envoyer bilan" doit s'afficher pour une étape.
 * Conditions : type review, pas déjà envoyée, due dans <= 7 jours ou en retard.
 */
export function canSendPackReview(step) {
  if (!step) return false;
  if (step.type !== 'review') return false;
  if (step.status === 'sent' || step.status === 'done') return false;
  const now = new Date();
  const due = new Date(step.dueDate);
  const daysUntilDue = (due - now) / (1000 * 60 * 60 * 24);
  return daysUntilDue <= 7;
}

/**
 * Retourne le template questionnaire pour une étape donnée.
 */
export function getReviewTemplateForStep(packType, stepNumber) {
  const pack = PACK_DEFINITIONS[packType];
  if (!pack) return null;
  const step = pack.steps[stepNumber - 1];
  if (!step || !step.template) return null;
  return REVIEW_TEMPLATES[step.template] || null;
}

/**
 * Vérifie les étapes dues ou en retard sur tous les clients.
 * Retourne un tableau d'alertes.
 */
export function checkStepsDue(clients) {
  const alerts = [];
  for (const client of clients) {
    const packType = client.packType;
    if (!packType || packType.startsWith('oneshot')) continue;

    const steps = buildPackFollowupSchedule(client);
    const prenom = client.prenom || client.form?.prenom || 'Client';

    for (const step of steps) {
      if (step.status === 'done') continue;
      if (step.isLate) {
        alerts.push({
          clientId: client.id,
          clientName: prenom,
          step,
          severity: 'late',
          message: `Étape en retard : ${step.label} — ${prenom}`,
        });
      } else if (step.isDueSoon && step.type === 'review') {
        alerts.push({
          clientId: client.id,
          clientName: prenom,
          step,
          severity: 'due_soon',
          message: `Questionnaire à envoyer cette semaine : ${step.label} — ${prenom}`,
        });
      }
    }
  }
  return alerts;
}

/**
 * Met à jour le statut d'une étape dans packSchedule du client.
 * Retour : le nouveau packSchedule à sauvegarder.
 */
export function updateStepStatus(client, stepNumber, updates) {
  const schedule = [...(client.packSchedule || [])];
  const idx = schedule.findIndex(s => s.stepNumber === stepNumber);
  const updated = {
    stepNumber,
    ...(idx >= 0 ? schedule[idx] : {}),
    ...updates,
  };
  if (idx >= 0) schedule[idx] = updated;
  else schedule.push(updated);
  return schedule;
}

/**
 * Calcule le taux de complétion du pack (KPI).
 */
export function getPackCompletion(client) {
  const steps = buildPackFollowupSchedule(client);
  if (steps.length === 0) return null;
  const done = steps.filter(s => s.status === 'done').length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}
