// ─── protocolPhases.js ────────────────────────────────────────────────────
// Service Phase A V97.17 — Helpers pour la timeline thérapeutique 5 phases.
//
// Stockage : consultation.protocol_phases (JSONB) + consultation.active_phase_id.
// Cf migration `migrations/V97.17_protocol_phases.sql`.
// Cf spec : memory `spec_v2_parcours_home_permanente_2026_05_16.md`.
//
// Responsabilités :
//  - Définir les 4 templates pré-configurés (microbiote 5/3, nutrition 2, custom)
//  - Suggérer un template selon les analyses détectées
//  - Créer une instance de phases à partir d'un template
//  - Valider la structure JSONB
//  - Calculer la phase active courante
//
// Pas de side effects, pas de fetch. Logique pure. Testable.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Identifiants des 4 templates disponibles.
 * @typedef {'microbiote_5_phases' | 'microbiote_3_phases' | 'nutrition_simple_2_phases' | 'custom'} TemplateId
 */

/**
 * Statut d'une phase. Pas de "skipped" (manifeste : un parcours thérapeutique
 * ralentit ou se prolonge, mais n'échoue jamais).
 * @typedef {'upcoming' | 'active' | 'completed'} PhaseStatus
 */

// ─── 4 TEMPLATES PRÉ-CONFIGURÉS ────────────────────────────────────────────

/**
 * Template Microbiote complet 5 phases (cas le plus fréquent quand microbiome
 * NGS est dans les analyses).
 */
export const TEMPLATE_MICROBIOTE_5 = {
  id: 'microbiote_5_phases',
  label: 'Microbiote complet — 5 phases',
  description: 'Parcours therapeutique long (microbiome detecte dans les analyses).',
  phases: [
    {
      id: 'p1',
      order: 1,
      client_name: 'Apaisement digestif',
      clinical_name: 'Eradication',
      duration_weeks_min: 4,
      duration_weeks_max: 4,
      narrative_present: 'Cette phase apaise votre système digestif et prépare le terrain.',
      narrative_past: 'Vous avez traversé la phase d\'apaisement. Votre digestion s\'est progressivement stabilisée.',
      narrative_future: 'Votre parcours commencera par l\'apaisement de votre système digestif.',
      // V97.18 amorce (V97.17.17) — Recommandations cliniques pre-configurees
      // par phase. Pour l'instant : DONNEES INDICATIVES qu'Anissa pourra
      // editer/valider en V97.19+. Sert deja a alimenter le bloc 'A faire
      // cette phase' du cockpit SaaS (visible mais pas encore auto-applique
      // au plan en cours).
      recommendations: {
        foods_favor: [
          'Cuissons douces (vapeur, mijoté, bouilli)',
          'Légumes pelés et bien cuits',
          'Bouillons d\'os',
          'Volailles maigres',
          'Riz blanc, sarrasin',
          'Bananes mûres',
          'Tisanes digestives (gingembre, fenouil)',
        ],
        foods_limit: [
          'Crudités et fibres dures (chou cru, légumineuses)',
          'Gluten',
          'Lait de vache et fromages affinés',
          'Sucres rapides',
          'Alcool',
          'Aliments industriels et émulsifiants',
        ],
        cooking: ['Vapeur', 'Mijoté lent', 'Bouillon'],
        cooking_avoid: ['Friture', 'Cru en grande quantité', 'Grillé fort'],
        supplements: [
          { name: 'L-glutamine', dose: '5 g', timing: 'matin à jeun' },
          { name: 'Probiotique multi-souches', dose: '1 gélule', timing: 'avant petit-déjeuner' },
          { name: 'Bouillon d\'os', dose: '1 bol', timing: 'soir avant repas' },
        ],
        clinical_notes:
          'Phase d\'apaisement : éviter tout ce qui irrite la muqueuse. Cuissons douces, fibres modérées. La L-glutamine soutient la barrière intestinale. Probiotique doux pour amorcer la diversité.',
      },
    },
    {
      id: 'p2',
      order: 2,
      client_name: 'Rééquilibrage intestinal',
      clinical_name: 'Restitution',
      duration_weeks_min: 4,
      duration_weeks_max: 4,
      narrative_present: 'Votre flore intestinale se rééquilibre progressivement. Cette phase soutient la diversité de votre microbiote.',
      narrative_past: 'Vous avez traversé la phase de rééquilibrage. Votre microbiote a gagné en stabilité.',
      narrative_future: 'Lorsque l\'apaisement sera installé, votre parcours s\'ouvrira au rééquilibrage de votre flore.',
      // V97.17.18 — recommandations indicatives (premier jet, a valider Anissa)
      recommendations: {
        foods_favor: [
          'Légumes cuits diversifiés (carottes, courgettes, fenouil, panais)',
          'Légumineuses bien cuites en petites quantités (lentilles corail)',
          'Fruits cuits (compote pommes, poires)',
          'Poissons gras (sardine, maquereau)',
          'Œufs bio',
          'Huile d\'olive vierge extra',
          'Yaourt brebis ou chèvre (si toléré)',
        ],
        foods_limit: [
          'Crudités en grandes quantités',
          'Fromages industriels',
          'Charcuteries',
          'Boissons sucrées',
          'Gluten (maintenu en pause)',
        ],
        cooking: ['Vapeur', 'Étuvée', 'Court bouillon'],
        cooking_avoid: ['Grillé fort', 'Friture'],
        supplements: [
          { name: 'Prébiotiques doux (PHGG, inuline)', dose: '5 g', timing: 'matin avec le petit-déjeuner' },
          { name: 'Probiotique multi-souches', dose: '1 gélule', timing: 'à jeun matin' },
          { name: 'L-glutamine', dose: '5 g', timing: 'continuer le matin à jeun' },
          { name: 'Magnésium bisglycinate', dose: '300 mg', timing: 'soir' },
        ],
        clinical_notes:
          'Réintroduction progressive de la diversité alimentaire. Prébiotiques doux pour nourrir la flore. Maintenir la pause gluten encore 4 semaines. Surveiller la tolérance des légumineuses et fibres.',
      },
    },
    {
      id: 'p3',
      order: 3,
      client_name: 'Réparation profonde',
      clinical_name: 'Leaky Gut',
      duration_weeks_min: 6,
      duration_weeks_max: 6,
      narrative_present: 'Cette phase soutient la réparation de votre barrière intestinale en profondeur.',
      narrative_past: 'Vous avez traversé la phase de réparation. Votre barrière intestinale a été renforcée.',
      narrative_future: 'Cette phase de réparation profonde viendra ensuite consolider votre barrière intestinale.',
      recommendations: {
        foods_favor: [
          'Poissons gras 2-3×/semaine (saumon sauvage, sardines)',
          'Œufs bio',
          'Foie de volaille (1×/semaine, source vitamine A naturelle)',
          'Légumes verts à feuilles (épinards, blettes, kale cuit)',
          'Avocat',
          'Graines de chia et lin (moulues, en petites quantités)',
          'Bouillon d\'os enrichi en collagène',
          'Curcuma + poivre noir dans les plats',
        ],
        foods_limit: [
          'Sucres ajoutés (même naturels en excès)',
          'Aliments ultra-transformés',
          'Alcool',
          'Café fort (1 max le matin)',
        ],
        cooking: ['Vapeur', 'Mijoté', 'Cuissons douces avec curcuma'],
        cooking_avoid: ['Cuissons hautes températures', 'Carbonisation'],
        supplements: [
          { name: 'Zinc bisglycinate', dose: '15 mg', timing: 'soir avec repas' },
          { name: 'Vitamine A naturelle (huile de foie de morue)', dose: '1 cuillère café', timing: 'matin' },
          { name: 'Oméga-3 EPA/DHA', dose: '2 g', timing: 'midi avec repas gras' },
          { name: 'L-glutamine', dose: '10 g', timing: 'matin et soir à jeun' },
          { name: 'Vitamine D3 + K2', dose: '2000 UI', timing: 'matin avec repas gras' },
        ],
        clinical_notes:
          'Phase clé de réparation de la barrière intestinale. Combinaison zinc + vitamine A + oméga 3 + L-glutamine à dose thérapeutique. Anti-inflammatoires naturels (curcuma). Diminuer charge inflammatoire (sucre, alcool).',
      },
    },
    {
      id: 'p4',
      order: 4,
      client_name: 'Consolidation',
      clinical_name: 'Reinoculation',
      duration_weeks_min: 6,
      duration_weeks_max: 6,
      narrative_present: 'Votre terrain digestif se consolide. Cette phase ancre durablement les bénéfices acquis.',
      narrative_past: 'Vous avez traversé la phase de consolidation. Votre terrain digestif s\'est ancré.',
      narrative_future: 'Une phase de consolidation viendra ensuite ancrer durablement les bénéfices acquis.',
      recommendations: {
        foods_favor: [
          'Aliments fermentés natuels (choucroute crue, kéfir d\'eau, miso non pasteurisé)',
          'Diversité maximale de légumes (30 variétés/semaine, défi microbiote)',
          'Fibres prébiotiques (oignon cuit, ail cuit, poireau, artichaut)',
          'Réintroduction progressive gluten (pain au levain, épeautre)',
          'Fruits frais variés (selon saison)',
          'Noix et amandes (poignée/jour, trempées si mieux tolérées)',
          'Légumineuses 2×/semaine',
        ],
        foods_limit: [
          'Restrictions levées sauf intolérances individuelles confirmées',
          'Garder vigilance sur ultra-transformés',
        ],
        cooking: ['Toutes méthodes', 'Variété encouragée'],
        cooking_avoid: ['Carbonisation systématique'],
        supplements: [
          { name: 'Probiotique multi-souches', dose: '1 gélule', timing: 'matin à jeun' },
          { name: 'Oméga-3', dose: '1 g', timing: 'midi' },
          { name: 'Vitamine D3 + K2', dose: '2000 UI', timing: 'matin' },
          { name: 'L-glutamine', dose: '5 g', timing: 'maintien matin si confort digestif maintenu' },
        ],
        clinical_notes:
          'Consolidation du terrain restauré. Introduction des fermentés naturels pour ensemencer la flore. Défi des 30 légumes/semaine (Tim Spector) pour maximiser la diversité. Diminution progressive des suppléments thérapeutiques.',
      },
    },
    {
      id: 'p5',
      order: 5,
      client_name: 'Stabilisation long terme',
      clinical_name: 'Stabilisation',
      duration_weeks_min: 0,        // ouvert
      duration_weeks_max: 0,        // ouvert (0 = pas de borne)
      narrative_present: 'Vous êtes dans la phase d\'équilibre durable. Votre nouveau terrain devient votre normalité.',
      narrative_past: 'Vous avez traversé votre parcours complet. Votre équilibre est désormais installé.',
      narrative_future: 'Votre parcours se conclura par une phase d\'équilibre durable.',
      recommendations: {
        foods_favor: [
          'Régime méditerranéen flexitarien',
          'Diversité maximale (30+ variétés végétales/semaine)',
          'Poissons 2-3×/semaine',
          'Cuissons douces majoritaires',
          'Fermentés réguliers',
          'Saisonnalité et localité privilégiées',
          'Plaisir et convivialité conservés',
        ],
        foods_limit: [
          'Pas de restriction stricte',
          'Écouter signaux individuels',
        ],
        cooking: ['Toutes méthodes', 'Plaisir et variété'],
        cooking_avoid: [],
        supplements: [
          { name: 'Oméga-3', dose: '1 g', timing: 'midi (entretien)' },
          { name: 'Vitamine D3 + K2', dose: '1000-2000 UI', timing: 'matin (modulé selon dosage sanguin)' },
          { name: 'Probiotique', dose: '1 gélule', timing: 'cure de 4 semaines tous les 3 mois' },
        ],
        clinical_notes:
          'Phase de croisière. Plus de restrictions thérapeutiques. Maintien des bons réflexes acquis. Bilan biologique annuel recommandé pour ajuster D3 et oméga 3. Réactiver une phase plus intensive si signaux de rechute (fatigue chronique, ballonnements récurrents).',
      },
    },
  ],
};

/**
 * Template Microbiote court 3 phases (cas analyses microbiome légères).
 */
export const TEMPLATE_MICROBIOTE_3 = {
  id: 'microbiote_3_phases',
  label: 'Microbiote court — 3 phases',
  description: 'Parcours therapeutique condense (microbiome simple).',
  phases: [
    {
      id: 'p1',
      order: 1,
      client_name: 'Apaisement digestif',
      clinical_name: 'Apaisement',
      duration_weeks_min: 4,
      duration_weeks_max: 4,
      narrative_present: 'Cette phase apaise votre système digestif et prépare le terrain.',
      narrative_past: 'Vous avez traversé la phase d\'apaisement.',
      narrative_future: 'Votre parcours commencera par l\'apaisement de votre système digestif.',
    },
    {
      id: 'p2',
      order: 2,
      client_name: 'Rééquilibrage intestinal',
      clinical_name: 'Rééquilibrage',
      duration_weeks_min: 4,
      duration_weeks_max: 4,
      narrative_present: 'Votre flore intestinale se rééquilibre. Cette phase soutient sa diversité.',
      narrative_past: 'Vous avez traversé la phase de rééquilibrage.',
      narrative_future: 'Votre parcours s\'ouvrira au rééquilibrage de votre flore.',
    },
    {
      id: 'p3',
      order: 3,
      client_name: 'Stabilisation long terme',
      clinical_name: 'Stabilisation',
      duration_weeks_min: 0,
      duration_weeks_max: 0,
      narrative_present: 'Vous êtes dans la phase d\'équilibre durable.',
      narrative_past: 'Votre équilibre est désormais installé.',
      narrative_future: 'Votre parcours se conclura par une phase d\'équilibre durable.',
    },
  ],
};

/**
 * Template Nutrition simple 2 phases (cas sans microbiome, sang seul ou pas d'analyse).
 */
export const TEMPLATE_NUTRITION_2 = {
  id: 'nutrition_simple_2_phases',
  label: 'Nutrition simple — 2 phases',
  description: 'Parcours nutritionnel direct (sans approche microbiote).',
  phases: [
    {
      id: 'p1',
      order: 1,
      client_name: 'Initiation',
      clinical_name: 'Initiation',
      duration_weeks_min: 4,
      duration_weeks_max: 4,
      narrative_present: 'Cette phase pose les bases de votre nouvel équilibre alimentaire.',
      narrative_past: 'Vous avez initié votre nouvel équilibre alimentaire.',
      narrative_future: 'Votre parcours commencera par l\'initiation à votre nouvel équilibre.',
    },
    {
      id: 'p2',
      order: 2,
      client_name: 'Consolidation',
      clinical_name: 'Consolidation',
      duration_weeks_min: 0,
      duration_weeks_max: 0,
      narrative_present: 'Vous consolidez vos acquis sur le long terme.',
      narrative_past: 'Vos acquis sont désormais consolidés.',
      narrative_future: 'Votre parcours se prolongera par la consolidation de vos acquis.',
    },
  ],
};

/**
 * Template vide pour configuration libre par Anissa.
 */
export const TEMPLATE_CUSTOM = {
  id: 'custom',
  label: 'Parcours personnalise',
  description: 'A configurer manuellement par Anissa.',
  phases: [],
};

/** Accès indexé par id. */
export const ALL_TEMPLATES = {
  microbiote_5_phases: TEMPLATE_MICROBIOTE_5,
  microbiote_3_phases: TEMPLATE_MICROBIOTE_3,
  nutrition_simple_2_phases: TEMPLATE_NUTRITION_2,
  custom: TEMPLATE_CUSTOM,
};

// ─── CACHE DB phase_recommendations (V97.22.2) ───────────────────────────
// Permet de lire les recommandations cliniques editees par Anissa via le
// cockpit "📋 Phases" plutôt que le hardcode JS. Pattern identique aux
// clinical_guardrails (cf _clinicalGuardrails.fr.js).
//
// Structure cache : { [`${templateKey}/${phaseId}`]: row }
// TTL 5 min pour eviter les fetch repetes en session.
//
// IMPORTANT : ALL_TEMPLATES + instanceFromTemplate NE LISENT PAS ce cache.
// Ils restent sur le hardcode JS pour la creation initiale du protocolPhases
// JSONB (snapshot stable). Le cache DB sert aux consumers V97.18 D-F qui
// veulent la version la plus a jour au moment d'une transition de phase.

let _phaseRecoCache = null; // Map<string, row>
let _phaseRecoCacheLoadedAt = 0;
const PHASE_RECO_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Précharge les recommandations par phase depuis Supabase.
 * Idempotent (no-op si TTL pas expire).
 * Fallback silencieux sur hardcode si DB down.
 *
 * @param {object} supabaseClient
 * @param {object} [opts]
 * @param {boolean} [opts.force=false]
 * @returns {Promise<{ ok: boolean, count?: number, source: 'supabase'|'hardcode', error?: string }>}
 */
export async function preloadPhaseRecommendationsFromSupabase(supabaseClient, opts = {}) {
  const { force = false } = opts;
  if (!force && _phaseRecoCache && (Date.now() - _phaseRecoCacheLoadedAt < PHASE_RECO_CACHE_TTL_MS)) {
    return { ok: true, count: _phaseRecoCache.size, source: 'supabase' };
  }
  if (!supabaseClient || typeof supabaseClient.from !== 'function') {
    return { ok: false, error: 'no supabase client', source: 'hardcode' };
  }
  try {
    const { data, error } = await supabaseClient
      .from('phase_recommendations')
      .select('template_key, phase_id, phase_order, client_name, clinical_name, foods_favor, foods_limit, cooking, cooking_avoid, supplements, clinical_notes, enabled')
      .eq('enabled', true);
    if (error || !Array.isArray(data) || data.length === 0) {
      return { ok: false, error: error?.message || 'empty table', source: 'hardcode' };
    }
    const map = new Map();
    for (const row of data) {
      map.set(`${row.template_key}/${row.phase_id}`, {
        ...row,
        foods_favor: row.foods_favor || [],
        foods_limit: row.foods_limit || [],
        cooking: row.cooking || [],
        cooking_avoid: row.cooking_avoid || [],
        supplements: row.supplements || [],
        clinical_notes: row.clinical_notes || '',
      });
    }
    _phaseRecoCache = map;
    _phaseRecoCacheLoadedAt = Date.now();
    return { ok: true, count: data.length, source: 'supabase' };
  } catch (e) {
    return { ok: false, error: e?.message || String(e), source: 'hardcode' };
  }
}

/**
 * Reset cache (utilise par tests).
 * @internal
 */
export function _resetPhaseRecoCache() {
  _phaseRecoCache = null;
  _phaseRecoCacheLoadedAt = 0;
}

/**
 * Source effective utilisee par getLivePhaseRecommendations.
 * @returns {'supabase'|'hardcode'}
 */
export function getPhaseRecoSource() {
  if (_phaseRecoCache && (Date.now() - _phaseRecoCacheLoadedAt < PHASE_RECO_CACHE_TTL_MS)) {
    return 'supabase';
  }
  return 'hardcode';
}

/**
 * Recupere les recommandations courantes (DB cache si frais, sinon hardcode)
 * pour une (templateKey, phaseId) donnee.
 *
 * Shape retournee :
 *   { client_name, clinical_name, foods_favor[], foods_limit[],
 *     cooking[], cooking_avoid[], supplements[{name,dose,timing}],
 *     clinical_notes, source: 'supabase'|'hardcode' }
 *
 * Retourne null si introuvable dans les 2 sources.
 *
 * @param {string} templateKey
 * @param {string} phaseId
 */
export function getLivePhaseRecommendations(templateKey, phaseId) {
  // 1. Try cache DB
  if (_phaseRecoCache && (Date.now() - _phaseRecoCacheLoadedAt < PHASE_RECO_CACHE_TTL_MS)) {
    const cached = _phaseRecoCache.get(`${templateKey}/${phaseId}`);
    if (cached) {
      return {
        client_name: cached.client_name,
        clinical_name: cached.clinical_name,
        foods_favor: cached.foods_favor,
        foods_limit: cached.foods_limit,
        cooking: cached.cooking,
        cooking_avoid: cached.cooking_avoid,
        supplements: cached.supplements,
        clinical_notes: cached.clinical_notes,
        source: 'supabase',
      };
    }
  }
  // 2. Fallback hardcode JS
  const template = ALL_TEMPLATES[templateKey];
  if (!template?.phases) return null;
  const phase = template.phases.find((p) => p.id === phaseId);
  if (!phase) return null;
  const reco = phase.recommendations;
  if (!reco) {
    return {
      client_name: phase.client_name,
      clinical_name: phase.clinical_name,
      foods_favor: [], foods_limit: [], cooking: [], cooking_avoid: [],
      supplements: [], clinical_notes: '',
      source: 'hardcode',
    };
  }
  return {
    client_name: phase.client_name,
    clinical_name: phase.clinical_name,
    foods_favor: reco.foods_favor || [],
    foods_limit: reco.foods_limit || [],
    cooking: reco.cooking || [],
    cooking_avoid: reco.cooking_avoid || [],
    supplements: reco.supplements || [],
    clinical_notes: reco.clinical_notes || '',
    source: 'hardcode',
  };
}

/**
 * Construit un bloc de prompt FR a injecter dans le composer pour
 * transmettre les recommandations de la phase active au LLM.
 * V97.18 Phase D.
 *
 * Format texte structure (pas markdown lourd, le LLM lit plus vite des
 * sections etiquetees en plain text).
 *
 * @param {object|null} reco - Output de getLivePhaseRecommendations
 * @param {object} [opts]
 * @param {number} [opts.weekNumber] - Semaine courante dans la phase (info contextuelle)
 * @returns {string} Bloc texte a concatener au prompt, '' si reco null/vide
 */
export function buildPhaseRecommendationsBlockFr(reco, opts = {}) {
  if (!reco) return '';
  const { weekNumber } = opts;

  // Si tout est vide (cas TEMPLATE_NUTRITION_2 sans recommendations) → skip
  const hasContent =
    (reco.foods_favor?.length || 0) +
    (reco.foods_limit?.length || 0) +
    (reco.cooking?.length || 0) +
    (reco.cooking_avoid?.length || 0) +
    (reco.supplements?.length || 0) +
    (reco.clinical_notes?.trim()?.length || 0) > 0;
  if (!hasContent) return '';

  const lines = [];
  lines.push('// ═══ RECOMMANDATIONS DE LA PHASE ACTIVE ═══');
  lines.push('');
  const phaseLabel = reco.client_name
    ? `${reco.client_name}${reco.clinical_name ? ` (clinique : ${reco.clinical_name})` : ''}`
    : (reco.clinical_name || 'Phase courante');
  lines.push(`Phase : ${phaseLabel}`);
  if (Number.isFinite(weekNumber) && weekNumber > 0) {
    lines.push(`Semaine en cours : ${weekNumber}`);
  }
  lines.push('');

  if (reco.foods_favor?.length) {
    lines.push('À PRIVILÉGIER dans le plan :');
    for (const item of reco.foods_favor) lines.push(`  - ${item}`);
    lines.push('');
  }
  if (reco.foods_limit?.length) {
    lines.push('À LIMITER ou ÉVITER (phase therapeutique) :');
    for (const item of reco.foods_limit) lines.push(`  - ${item}`);
    lines.push('');
  }
  if (reco.cooking?.length) {
    lines.push(`MODES DE CUISSON recommandés : ${reco.cooking.join(', ')}`);
  }
  if (reco.cooking_avoid?.length) {
    lines.push(`Cuissons à éviter : ${reco.cooking_avoid.join(', ')}`);
  }
  if (reco.cooking?.length || reco.cooking_avoid?.length) lines.push('');

  if (reco.supplements?.length) {
    lines.push('COMPLÉMENTS du protocole (à mentionner explicitement dans le plan si la cliente est ouverte) :');
    for (const s of reco.supplements) {
      const parts = [s.name];
      if (s.dose) parts.push(s.dose);
      if (s.timing) parts.push(s.timing);
      lines.push(`  - ${parts.join(' — ')}`);
    }
    lines.push('');
  }

  if (reco.clinical_notes?.trim()) {
    lines.push('Notes cliniques de la phase :');
    lines.push(`  ${reco.clinical_notes.trim()}`);
    lines.push('');
  }

  lines.push('Regle : cette phase est therapeutique. Aligne le plan sur ces recommandations.');
  lines.push('Les aliments "à privilégier" doivent dominer ; les "à limiter" ne doivent pas apparaître comme suggestions principales.');

  return lines.join('\n');
}

// ─── SUGGESTION TEMPLATE selon analyses ──────────────────────────────────

/**
 * Suggère un template selon les analyses détectées sur la cliente.
 * V97.17.5.2 : ajout du flag `autoApply` + `confidence`.
 *
 * Règle Anissa 2026-05-16 affinée :
 *  - confidence 'high' (analyse claire) → autoApply = true, Anissa n'a rien à valider
 *  - confidence 'low' (fallback sans analyse) → autoApply = false, Anissa valide
 *
 * Le manifeste "IA suggère → Anissa valide" s'applique aux décisions cliniques,
 * pas aux évidences. Si Camille a fait le microbiome, elle est OBVIOUS sur
 * les 5 phases — pas besoin de cliquer Accepter.
 *
 * @param {object} client - Cliente avec analysisPlan / analyses
 * @returns {{ templateId: TemplateId, reason: string, confidence: 'high'|'low', autoApply: boolean }}
 */
export function suggestTemplateFromAnalyses(client) {
  // Source possible des analyses : client.analysisPlan?.items[] ou
  // client.analyses[] ou client.form.analyses. On agrège tout en lowercase.
  const sources = [
    ...(client?.analysisPlan?.items || []),
    ...(client?.analyses || []),
    ...(client?.form?.analyses || []),
  ];
  const allText = sources
    .map((a) => (typeof a === 'string' ? a : a?.name || a?.label || ''))
    .join(' ')
    .toLowerCase();

  // Détection microbiome (NGS, séquençage, microbiote NGS, etc.)
  const hasMicrobiome = /microbiom|ngs|s[eé]quen|flora ngs/.test(allText);
  // Détection sang (bilan sanguin, biologie, prise de sang)
  const hasBlood = /sang|sanguin|biologie|prise de sang|bilan biolog/.test(allText);

  if (hasMicrobiome) {
    return {
      templateId: 'microbiote_5_phases',
      confidence: 'high',
      autoApply: true,
      reason: 'Microbiome detecte dans les analyses.',
    };
  }
  if (hasBlood && sources.length > 0) {
    return {
      templateId: 'nutrition_simple_2_phases',
      confidence: 'high',
      autoApply: true,
      reason: 'Bilan sanguin detecte (sans microbiome).',
    };
  }
  // Aucune analyse identifiable → fallback nutrition simple (non auto-applique).
  // Le microbiote 5 phases ne doit etre propose QUE si le test microbiote est
  // detecte : proposer un parcours nutrition 2 phases est coherent avec un pack
  // sans analyse (ex: Bilan Nutritionnel). Anissa valide via le banner + Accepter,
  // et peut toujours basculer sur le microbiote via "Choisir un autre".
  return {
    templateId: 'nutrition_simple_2_phases',
    confidence: 'low',
    autoApply: false,
    reason: 'Pas d\'analyse identifiable - parcours nutrition 2 phases propose par defaut (a valider).',
  };
}

// ─── INSTANCE depuis template ────────────────────────────────────────────

/**
 * Crée une instance de protocol_phases prête à stocker depuis un template.
 * Toutes les phases démarrent en status "upcoming". active_phase_id = null.
 *
 * @param {TemplateId} templateId
 * @returns {{ template: TemplateId, phases: Array }}
 */
export function instanceFromTemplate(templateId) {
  const template = ALL_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`protocolPhases: template inconnu "${templateId}"`);
  }
  return {
    template: template.id,
    phases: template.phases.map((p) => ({
      ...p,
      status: 'upcoming',
      started_at: null,
      completed_at: null,
      retrospective: { objectives_achieved: [], dominant_feelings: [] },
    })),
  };
}

// ─── HELPERS état ────────────────────────────────────────────────────────

/**
 * Récupère la phase active (status === "active") ou null.
 */
export function getActivePhase(protocolPhases) {
  if (!protocolPhases?.phases?.length) return null;
  return protocolPhases.phases.find((p) => p.status === 'active') || null;
}

/**
 * Calcule la semaine en cours de la phase active.
 * Retourne { weekNumber, maxWeeks } ou null si pas calculable.
 * "weekNumber" est 1-based.
 */
export function getActivePhaseWeek(protocolPhases) {
  const active = getActivePhase(protocolPhases);
  if (!active?.started_at) return null;
  const started = new Date(active.started_at);
  if (Number.isNaN(started.getTime())) return null;
  const now = new Date();
  const diffMs = now - started;
  const diffWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
  return {
    weekNumber: Math.max(1, diffWeeks + 1),
    maxWeeks: active.duration_weeks_max || null,
  };
}

/**
 * Suggère la transition vers la prochaine phase si la durée min est atteinte.
 * Toujours côté SaaS : c'est Anissa qui valide, jamais auto-apply.
 *
 * @returns {{ shouldSuggest: boolean, nextPhaseId: string | null, reason: string }}
 */
export function suggestNextPhase(protocolPhases) {
  const active = getActivePhase(protocolPhases);
  if (!active) return { shouldSuggest: false, nextPhaseId: null, reason: 'Pas de phase active.' };

  const weekInfo = getActivePhaseWeek(protocolPhases);
  if (!weekInfo) return { shouldSuggest: false, nextPhaseId: null, reason: 'Date de demarrage inconnue.' };

  const minWeeks = active.duration_weeks_min || 0;
  if (minWeeks === 0) {
    // Phase sans durée (stabilisation long terme) — pas de suggestion auto
    return { shouldSuggest: false, nextPhaseId: null, reason: 'Phase ouverte (pas de borne min).' };
  }

  if (weekInfo.weekNumber < minWeeks) {
    return {
      shouldSuggest: false,
      nextPhaseId: null,
      reason: `Encore ${minWeeks - weekInfo.weekNumber} semaine(s) min sur cette phase.`,
    };
  }

  const phases = protocolPhases.phases;
  const idx = phases.findIndex((p) => p.id === active.id);
  const next = phases[idx + 1];
  if (!next) {
    return { shouldSuggest: false, nextPhaseId: null, reason: 'Derniere phase du parcours.' };
  }

  return {
    shouldSuggest: true,
    nextPhaseId: next.id,
    reason: `Phase "${active.client_name}" : duree minimale atteinte (${minWeeks} sem). Prochaine phase suggeree : "${next.client_name}".`,
  };
}

/**
 * Marque la phase courante terminée et active la suivante.
 * Logique pure — retourne le nouveau protocolPhases. À cloudSync ensuite.
 *
 * V97.25 (audit HIGH-8 fix) — Garde le throw pour rétro-compat avec les
 * 2 callers actuels (ClientJourneyPage / JourneyPhasesCard) qui wrap en
 * try/catch. Future API recommandee : transitionToNextPhaseSafe ci-dessous.
 */
export function transitionToNextPhase(protocolPhases) {
  const active = getActivePhase(protocolPhases);
  if (!active) throw new Error('transitionToNextPhase: pas de phase active.');

  const phases = protocolPhases.phases;
  const idx = phases.findIndex((p) => p.id === active.id);
  const next = phases[idx + 1];
  if (!next) throw new Error('transitionToNextPhase: derniere phase, pas de suivante.');

  const now = new Date().toISOString();
  const updatedPhases = phases.map((p, i) => {
    if (i === idx) return { ...p, status: 'completed', completed_at: now };
    if (i === idx + 1) return { ...p, status: 'active', started_at: now };
    return p;
  });

  return {
    ...protocolPhases,
    phases: updatedPhases,
  };
}

/**
 * V97.25 — Variante safe (Result pattern) cohérente avec le reste du module.
 * @returns {{ ok: true, data: object } | { ok: false, error: string, reason: string }}
 */
export function transitionToNextPhaseSafe(protocolPhases) {
  try {
    const data = transitionToNextPhase(protocolPhases);
    return { ok: true, data };
  } catch (e) {
    const msg = e?.message || 'erreur transition';
    return {
      ok: false,
      error: msg,
      reason: msg.includes('derniere phase') ? 'last_phase' : 'no_active_phase',
    };
  }
}

/**
 * Démarre le parcours : active la première phase upcoming.
 */
export function startParcours(protocolPhases) {
  if (!protocolPhases?.phases?.length) {
    throw new Error('startParcours: aucune phase configuree.');
  }
  if (getActivePhase(protocolPhases)) {
    throw new Error('startParcours: une phase est deja active.');
  }
  const now = new Date().toISOString();
  const updatedPhases = protocolPhases.phases.map((p, i) =>
    i === 0 ? { ...p, status: 'active', started_at: now } : p
  );
  return {
    ...protocolPhases,
    phases: updatedPhases,
  };
}

/**
 * Validation structurelle minimale du JSONB (defensive).
 */
export function isValidProtocolPhases(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.template !== 'string') return false;
  if (!Array.isArray(value.phases)) return false;
  for (const p of value.phases) {
    if (!p?.id || typeof p.order !== 'number') return false;
    if (!['upcoming', 'active', 'completed'].includes(p.status)) return false;
  }
  // Au plus 1 phase active
  const activeCount = value.phases.filter((p) => p.status === 'active').length;
  if (activeCount > 1) return false;
  return true;
}

/**
 * V97.39.8 (roadmap 1.1) — Greffe des phases "en attente" sur une consultation.
 *
 * Contexte : quand Anissa accepte un parcours AVANT qu'une consultation existe
 * (cas pack Bilan : page Suivi atteinte sans plan, cf. melissa), on stocke les
 * phases dans journey_state.pending_protocol_phases — on NE cree PAS de
 * consultation (ca consommerait le compteur de pack). Des qu'une consultation
 * existe, on greffe ces phases dessus.
 *
 * Point de centralisation unique : peu importe le chemin de creation de la
 * consultation (editeur de plan, "Creer la suite", import…), le transfert
 * passe par cette fonction. store.js ne peut pas l'heberger (synchrone,
 * localStorage-only, aucun acces a journey_state qui est Supabase-only).
 *
 * Pure : ne touche ni Supabase ni localStorage. Retourne un nouveau brouillon
 * de consultation pret pour saveNutritionConsultation. Ne greffe PAS si :
 *   - pas de phases en attente, OU
 *   - pas de consultation hote, OU
 *   - la consultation porte deja des phases (elle gagne — pas d'ecrasement).
 *
 * @returns {{ consultation: object, baked: boolean }}
 */
export function bakePendingProtocolPhases(consultation, pendingPhases) {
  if (!consultation || !pendingPhases || consultation.protocol_phases) {
    return { consultation, baked: false };
  }
  const activePhaseId = getActivePhase(pendingPhases)?.id || null;
  return {
    consultation: {
      ...consultation,
      protocol_phases: pendingPhases,
      active_phase_id: activePhaseId,
    },
    baked: true,
  };
}
