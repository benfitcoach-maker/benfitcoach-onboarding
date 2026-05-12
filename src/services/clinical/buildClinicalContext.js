// V97.4 Phase V3.D — Constructeur clinicalContext + propagation markers à l'IA.
// Date : 2026-05-12
//
// Rôle : transformer les données déjà saisies par Anissa dans le SaaS
// (journey_state.results_data + form anamnèse) en un objet `clinicalContext`
// au format attendu par `_clinicalContext.fr.js` (Phase V1).
//
// Architecture (cf. discussion 2026-05-12) :
//   journey_state.results_data + form
//   → buildClinicalContext()
//   → clinicalContext (enrichi via catalog Ortho-Analytic + markers)
//   → buildSystemPromptFrV2(..., { useComposer: true, clinicalContext })
//
// V2.A — branchement minimal des données existantes :
//   - selectedTests : depuis results_data.from_plan (tests prescrits)
//   - enteredResults : depuis results_data.from_plan + results_data.external
//     (filtrés sur ceux qui ont une valeur OU une synthèse Anissa)
//   - clinicalSignals : propagation 1:1 des `status` saisis manuellement
//     par Anissa (status: 'prioritaire' | 'surveiller').
//
// V3.B — enrichissement via catalogue :
//   - selectedTests : lookup catalog/orthoAnalyticTests.js par test_code,
//     enrichis avec lab, category, clinical_category (axe), price_chf, description.
//     Fallback gracieux si test absent du catalogue (comportement V2.A).
//   - expectedMarkers : agrégation des marqueurs attendus de tous les tests
//     prescrits, dédupliqués par code, enrichis depuis catalog/markers.js.
//
// V3.D (CURRENT) — propagation des markers détaillés saisis par Anissa :
//   - enteredResults : chaque enteredResult est tagué `source_level: "test"`
//     (V2.A legacy) OU `source_level: "marker"` (nouveau). L'IA peut ainsi
//     distinguer une lecture clinique globale d'une valeur marker spécifique.
//     Label marker formaté : "{test_name} → {marker_label}" pour traçabilité.
//   - clinicalSignals : si un marker a status === 'prioritaire'|'surveiller',
//     un signal est créé avec `confidence: "note Anissa marker"` (vs
//     "note Anissa" au niveau test). Permet à l'IA de différencier la source.
//   - PAS de déduplication agressive : un même marqueur dans 2 tests peut
//     donner 2 entrées (utile longitudinal T0/T1 → V3.E).
//
// V3.D NE FAIT PAS encore :
//   - Auto-détection avancée de signaux depuis valeurs brutes
//   - Moteur microbiomeStage (phases 1-5)
//   - Scoring composé
//   - Déduplication T0/T1 (V3.E)
//   - promptModules / safetyRules dynamiques
//
// Tout cela viendra plus tard (V3.E+ / V4) sans casser l'API actuelle.

import { getTest, getExpectedMarkersForTest } from './catalog/orthoAnalyticTests';

/**
 * Construit l'objet clinicalContext propre à partir des données saisies
 * dans le parcours cliente. Ne throw jamais.
 *
 * @param {object} args
 * @param {object} [args.journeyState] - client.journey_state (JSONB Supabase)
 * @param {object} [args.form] - client.form (anamnèse) — non utilisé V3.B,
 *   préservé pour V3.C+ (auto-détection signaux croisant anamnèse + résultats).
 * @param {Array}  [args.catalog] - réservé V4 (override / injection catalogue
 *   custom pour tests). En V3.B, le catalogue Ortho-Analytic est importé
 *   statiquement depuis ./catalog/orthoAnalyticTests.js.
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
  // V3.B : lookup catalogue par test_code. Si trouvé → enrichi (lab,
  // price_chf, clinical_category, description). Si absent du catalogue
  // → fallback V2.A (nom + category saisis manuellement par Anissa).
  // Tolérant : test_code peut être absent (entrée freeform Anissa).
  const selectedTests = fromPlan
    .map((r) => {
      const code = r.test_code || r.code || null;
      const catalogEntry = code ? getTest(code) : null;

      if (catalogEntry) {
        // Test reconnu — on enrichit depuis le catalogue, mais on laisse la
        // valeur saisie par Anissa primer sur la catégorie (Anissa peut avoir
        // re-classifié manuellement).
        return {
          code: catalogEntry.code,
          name: catalogEntry.name,
          lab: catalogEntry.lab || null,
          category: r.category || catalogEntry.category || null,
          clinical_category: catalogEntry.clinical_category || null,
          price_chf: catalogEntry.price_chf ?? null,
          description: catalogEntry.description || null,
        };
      }

      // Fallback V2.A : test hors catalogue (entrée manuelle Anissa)
      const name = r.test_name || r.test_code;
      if (!name) return null;
      return {
        code: code || null,
        name,
        lab: r.lab || null,
        category: r.category || null,
        clinical_category: null,
        price_chf: null,
        description: null,
      };
    })
    .filter(Boolean);

  // ─── expectedMarkers : marqueurs attendus agrégés et dédupliqués ──
  // V3.B : pour chaque test prescrit, on récupère ses marqueurs attendus
  // depuis le catalogue markers.js (via getExpectedMarkersForTest).
  // Dédoublonnage par code (ferritine peut être attendu par 2 tests, on
  // ne le liste qu'une fois). Mapping vers un shape consommateur stable :
  //   { id, code, label, unit, clinical_axis, reference_range, notes }
  // Tolérant : test hors catalogue → 0 marker contribué, pas d'erreur.
  const markersByCode = new Map();
  for (const r of fromPlan) {
    const code = r.test_code || r.code;
    if (!code) continue;
    const markers = getExpectedMarkersForTest(code);
    if (!Array.isArray(markers) || markers.length === 0) continue;
    for (const m of markers) {
      if (!m || !m.code) continue;
      if (markersByCode.has(m.code)) continue;
      markersByCode.set(m.code, {
        id: m.code,
        code: m.code,
        label: m.label || m.code,
        unit: m.unit || null,
        clinical_axis: m.axis || null,
        secondary_axes: Array.isArray(m.secondary_axes) ? m.secondary_axes : [],
        reference_range: m.ref_range || null,
        notes: m.notes || null,
      });
    }
  }
  const expectedMarkers = Array.from(markersByCode.values());

  // ─── enteredResults : tous les résultats avec valeur ou synthèse ─
  // V3.D : 2 niveaux distincts pour que l'IA ne mélange pas lecture
  // globale niveau test vs valeur marker spécifique.
  //   - source_level: "test"   → champ value/synthesis saisi au niveau carte test
  //   - source_level: "marker" → valeur/note saisie sur une ligne marker spécifique
  // Aucune déduplication entre les deux (un test peut avoir une lecture
  // globale + plusieurs valeurs markers, l'IA reçoit les deux contextes).
  const allResults = [...fromPlan, ...external];

  // a) Niveau test (V2.A legacy, juste tagué source_level)
  const testLevelEntries = allResults
    .map((r) => {
      const label = r.test_name || r.test_code || r.name;
      if (!label) return null;
      if (!r.value && !r.synthesis) return null;
      return {
        label,
        value: r.value || '',
        synthesis: r.synthesis || '',
        source_level: 'test',
      };
    })
    .filter(Boolean);

  // b) Niveau marker (V3.D nouveau) — uniquement depuis from_plan,
  // les analyses externes n'ont pas de markers[] (input freeform).
  const markerLevelEntries = [];
  for (const r of fromPlan) {
    if (!Array.isArray(r.markers)) continue;
    const testLabel = r.test_name || r.test_code || 'Test sans nom';
    for (const m of r.markers) {
      if (!m) continue;
      if (!m.value && !m.synthesis) continue;
      const markerLabel = m.label || m.marker_code || 'Marqueur';
      markerLevelEntries.push({
        label: `${testLabel} → ${markerLabel}`,
        value: m.value || '',
        synthesis: m.synthesis || '',
        source_level: 'marker',
        unit: m.unit || null,
      });
    }
  }

  const enteredResults = [...testLevelEntries, ...markerLevelEntries];

  // ─── clinicalSignals : propagation 1:1 des status Anissa ─────────
  // Pas d'auto-détection IA. Anissa a manuellement marqué étape 4 chaque
  // résultat comme 'optimal' | 'surveiller' | 'prioritaire'. On propage
  // les 2 derniers comme signaux pour informer l'IA de générer un plan
  // qui adresse explicitement ces priorités cliniques.
  //
  // V3.D : 2 sources distinctes pour permettre à l'IA de pondérer.
  //   - confidence: "note Anissa"        → status saisi au niveau test
  //   - confidence: "note Anissa marker" → status saisi sur un marker spécifique
  //
  // Pas de déduplication : si un test est "prioritaire" ET un de ses markers
  // l'est aussi, l'IA reçoit les 2 signaux. C'est volontaire — la précision
  // marker enrichit l'information sans masquer le signal global.
  const PRIORITY_MAP = { prioritaire: 1, surveiller: 2 };

  // a) Niveau test (V2.A legacy, juste précisée confidence)
  const testLevelSignals = allResults
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

  // b) Niveau marker (V3.D nouveau)
  const markerLevelSignals = [];
  for (const r of fromPlan) {
    if (!Array.isArray(r.markers)) continue;
    const testLabel = r.test_name || r.test_code || 'Test';
    for (const m of r.markers) {
      if (!m) continue;
      const status = m.status;
      if (status !== 'prioritaire' && status !== 'surveiller') continue;
      const markerLabel = m.label || m.marker_code || 'Marqueur';
      const composed = `${testLabel} → ${markerLabel}`;
      markerLevelSignals.push({
        id: `${status}_${slugify(`${testLabel}_${markerLabel}`)}`,
        label: status === 'prioritaire'
          ? `${composed} — priorité haute (Anissa)`
          : `${composed} — à surveiller (Anissa)`,
        priority: PRIORITY_MAP[status],
        confidence: 'note Anissa marker',
        source_markers: [markerLabel],
      });
    }
  }

  const clinicalSignals = [...testLevelSignals, ...markerLevelSignals];

  // ─── V3.D : champs non encore branchés (réservés V3.E+ / V4) ─────
  // Retournés vides pour respecter le shape attendu par _clinicalContext.fr.js
  // sans rien inventer.
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
