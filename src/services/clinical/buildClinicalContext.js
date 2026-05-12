// V97.4 Phase V2.A — Constructeur clinicalContext (sans branchement UI).
// Date : 2026-05-12
//
// Rôle : transformer les données déjà saisies par Anissa dans le SaaS
// (journey_state.results_data + form anamnèse) en un objet `clinicalContext`
// au format attendu par `_clinicalContext.fr.js` (Phase V1).
//
// Architecture (cf. discussion 2026-05-12) :
//   journey_state.results_data + form
//   → buildClinicalContext()
//   → clinicalContext
//   → buildSystemPromptFrV2(..., { useComposer: true, clinicalContext })
//
// V2.A : branchement MINIMAL des données existantes.
//   - selectedTests : depuis results_data.from_plan (tests prescrits)
//   - enteredResults : depuis results_data.from_plan + results_data.external
//     (filtrés sur ceux qui ont une valeur OU une synthèse Anissa)
//   - clinicalSignals : propagation 1:1 des `status` saisis manuellement
//     par Anissa (status: 'prioritaire' | 'surveiller'). PAS d'inférence IA,
//     juste de la transformation de données déjà capturées étape 4.
//
// V2.A NE FAIT PAS encore :
//   - Lookup catalogue (Ortho-Analytic / MGD) pour enrichir name → lab/price/category
//   - Auto-détection avancée de signaux depuis valeurs brutes
//   - Mapping test → expectedMarkers (catalogue de marqueurs)
//   - Moteur microbiomeStage (phases 1-5)
//   - Scoring composé
//
// Tout cela viendra plus tard (V2.B+ / V3) sans casser l'API actuelle.

/**
 * Construit l'objet clinicalContext propre à partir des données saisies
 * dans le parcours cliente. Ne throw jamais.
 *
 * @param {object} args
 * @param {object} [args.journeyState] - client.journey_state (JSONB Supabase)
 * @param {object} [args.form] - client.form (anamnèse) — non utilisé V2.A
 *   mais préservé pour V3 (auto-détection signaux croisant anamnèse + résultats).
 * @param {Array}  [args.catalog] - réservé V3 (lookup name → lab/price/category).
 * @returns {object} clinicalContext au format _clinicalContext.fr.js
 */
// eslint-disable-next-line no-unused-vars
export function buildClinicalContext({ journeyState, form: _form, catalog: _catalog } = {}) {
  // Garde-fous : ne throw jamais, retourne toujours un objet valide
  const journey = journeyState || {};
  const rd = journey.results_data || {};
  const fromPlan = Array.isArray(rd.from_plan) ? rd.from_plan : [];
  const external = Array.isArray(rd.external) ? rd.external : [];

  // ─── selectedTests : tests prescrits depuis from_plan ─────────────
  // V2.A : nom + category (saisis par Anissa étape 4 BC.5D.2).
  // V3 : enrichir via lookup catalog (lab, price_chf, ...).
  const selectedTests = fromPlan
    .map((r) => {
      const name = r.test_name || r.test_code;
      if (!name) return null;
      return {
        name,
        category: r.category || null,
      };
    })
    .filter(Boolean);

  // ─── enteredResults : tous les résultats avec valeur ou synthèse ─
  // Inclut from_plan ET external. Filtre ceux qui sont vides.
  const allResults = [...fromPlan, ...external];
  const enteredResults = allResults
    .map((r) => {
      const label = r.test_name || r.test_code || r.name;
      if (!label) return null;
      if (!r.value && !r.synthesis) return null;
      return {
        label,
        value: r.value || '',
        synthesis: r.synthesis || '',
      };
    })
    .filter(Boolean);

  // ─── clinicalSignals : propagation 1:1 des status Anissa ─────────
  // Pas d'auto-détection IA. Anissa a manuellement marqué étape 4 chaque
  // résultat comme 'optimal' | 'surveiller' | 'prioritaire'. On propage
  // les 2 derniers comme signaux pour informer l'IA de générer un plan
  // qui adresse explicitement ces priorités cliniques.
  // Source : note saisie par la praticienne. Confidence = "note Anissa".
  const PRIORITY_MAP = { prioritaire: 1, surveiller: 2 };
  const clinicalSignals = allResults
    .map((r) => {
      const status = r.status;
      if (status !== 'prioritaire' && status !== 'surveiller') return null;
      const label = r.test_name || r.test_code || r.name;
      if (!label) return null;
      return {
        id: `${status}_${slugify(label)}`,
        label: status === 'prioritaire'
          ? `${label} — priorité haute (Anissa)`
          : `${label} — à surveiller (Anissa)`,
        priority: PRIORITY_MAP[status],
        confidence: 'note Anissa',
        source_markers: [label],
      };
    })
    .filter(Boolean);

  // ─── V2.A : champs non encore branchés (réservés V3+) ────────────
  // Retournés vides pour respecter le shape attendu par _clinicalContext.fr.js
  // sans rien inventer.
  const expectedMarkers = [];
  const microbiomeStage = null;
  const promptModules = [];
  const safetyRules = [];

  return {
    selectedTests,
    expectedMarkers,
    enteredResults,
    clinicalSignals,
    microbiomeStage,
    promptModules,
    safetyRules,
  };
}

/**
 * Slugify minimaliste pour générer des `id` stables et lisibles.
 * Pas de dépendance externe.
 */
function slugify(input) {
  if (!input || typeof input !== 'string') return 'unknown';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'unknown';
}
