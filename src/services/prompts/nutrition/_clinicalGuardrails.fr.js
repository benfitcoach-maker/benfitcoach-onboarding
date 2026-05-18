// ─── _clinicalGuardrails.fr.js ─────────────────────────────────────────
// V97.x Phase 1 (urgent risque légal) — Couche de garde-fous cliniques
// pour le composer FR.
//
// Cf spec : C:\Users\benoi\OneDrive\Desktop\Claude\spec-composer-v97-clinical-antislop.md
// Cf trigger : audit plan Hawazen (grossesse T2 + TDAH) → 2 phrases
// médicales à risque détectées :
//   - "ÉVITER TES INJECTIONS ANNUELLES" (promet d'éviter une intervention)
//   - "Plus efficace que les comprimés seuls" (contredit reco médicale)
//
// Phase 1 = phrases interdites uniquement (grossesse). Phase 2 = matrice
// complète des 7 profils + DB seed + micronutriments + évictions.
//
// Architecture : hardcode JS pour Phase 1 (rapide, déterministe, testable).
// Migration vers table `clinical_guardrails` en Phase 2 quand Anissa aura
// confirmé les règles métier.

/**
 * @typedef {object} Guardrail
 * @property {string} profile_key - Identifiant unique du profil
 * @property {string} display_name - Nom affiché dans les UI/audit
 * @property {string[]} forbidden_phrases - Phrases interdites (lowercase, matching insensible casse)
 * @property {string[]} required_phrases - Phrases obligatoirement présentes (Phase 2)
 * @property {string[]} micronutrients - Micro à mentionner (Phase 2)
 * @property {string[]} evictions - Aliments/comportements à éviter mentionnés (Phase 2)
 * @property {Record<string, string>} precaution_vocab - Vocabulaire de précaution {forbidden: replacement}
 */

// ─── PHRASES INTERDITES TRANSVERSES ──────────────────────────────────────
// Verbes médicaux et formulations à risque applicables à TOUS les profils
// (scope nutritionniste strict). Factorisés pour éviter duplication par profil.

const FORBIDDEN_MEDICAL_VERBS = [
  'guérir',
  'guérit',
  'soigner ta',
  'soigner ton',
  'traiter ta',
  'traiter ton',
  'diagnostiquer',
];

const FORBIDDEN_REPLACE_MEDIC = [
  'à la place du médecin',
  'à la place de ton médecin',
  'remplacer le médecin',
  'remplace ton médecin',
  'tu n\'as pas besoin de médecin',
  'sans avis médical',
  'arrête ton traitement',
  'arrête tes médicaments',
];

const FORBIDDEN_REPLACE_SUPPLEMENTATION = [
  'plus efficace que les comprimés',
  'plus efficace que tes comprimés',
  'plus efficace que ta supplémentation',
  'remplace tes comprimés',
  'remplacer tes comprimés',
  'à la place de tes comprimés',
  'à la place de ta supplémentation',
];

const FORBIDDEN_AVOID_INJECTION = [
  'éviter tes injections',
  'éviter les injections',
  'éviter ton injection',
  'évite tes injections',
  'éviter les injections annuelles',
  'remplacer tes injections',
  'remplace tes injections',
  'à la place du fer prescrit',
];

const PRECAUTION_VOCAB_BASE = {
  'à la place de': 'en complément de',
  'remplace': 'complète',
  'au lieu de prendre': 'en plus de prendre',
};

/**
 * Garde-fous PHASE 2 — matrice complète 7 profils en JS hardcode.
 * Migration vers table Supabase `clinical_guardrails` à venir quand
 * Anissa aura validé les règles métier en pratique.
 *
 * @type {Record<string, Guardrail>}
 */
export const GUARDRAILS_FR = {
  // ─── GROSSESSE (tous trimestres confondus pour V1) ────────────────────
  grossesse: {
    profile_key: 'grossesse',
    display_name: 'Grossesse',
    forbidden_phrases: [
      ...FORBIDDEN_AVOID_INJECTION,
      ...FORBIDDEN_REPLACE_SUPPLEMENTATION,
      ...FORBIDDEN_REPLACE_MEDIC,
      ...FORBIDDEN_MEDICAL_VERBS,
      'régime restrictif',
      'perte de poids',
      'déficit calorique',
    ],
    required_phrases: [
      'éviter listeria',
      'éviter toxoplasmose',
      'éviter mercure',
      'éviter alcool',
    ],
    micronutrients: [
      'acide folique',
      'B9',
      'iode',
      'B12',
      'vitamine D',
      'fer',
      'oméga-3',
    ],
    evictions: [
      'listeria',
      'toxoplasmose',
      'alcool',
      'mercure (gros poissons)',
      'foie',
      'fromages au lait cru',
      'charcuterie crue',
      'sushi crus',
    ],
    precaution_vocab: { ...PRECAUTION_VOCAB_BASE },
  },

  // ─── ALLAITEMENT ──────────────────────────────────────────────────────
  allaitement: {
    profile_key: 'allaitement',
    display_name: 'Allaitement',
    forbidden_phrases: [
      ...FORBIDDEN_MEDICAL_VERBS,
      ...FORBIDDEN_REPLACE_MEDIC,
      'régime restrictif',
      'perte de poids rapide',
      'déficit calorique',
      'jeûne intermittent',
      'cure détox',
    ],
    required_phrases: [
      'hydratation suffisante',
      'éviter alcool',
    ],
    micronutrients: [
      'iode',
      'B12',
      'vitamine D',
      'oméga-3',
      'fer',
      'calcium',
    ],
    evictions: [
      'alcool',
      'caféine en excès (>200mg/j)',
      'sauge (inhibe lactation)',
      'menthe poivrée à forte dose',
      'persil à forte dose',
    ],
    precaution_vocab: { ...PRECAUTION_VOCAB_BASE },
  },

  // ─── POST-PARTUM ──────────────────────────────────────────────────────
  postPartum: {
    profile_key: 'postPartum',
    display_name: 'Post-partum',
    forbidden_phrases: [
      ...FORBIDDEN_MEDICAL_VERBS,
      ...FORBIDDEN_REPLACE_MEDIC,
      'retrouver ta ligne',
      'perdre les kilos de la grossesse',
      'régime restrictif',
      'avant la grossesse',
    ],
    required_phrases: [
      'récupération progressive',
    ],
    micronutrients: [
      'fer',
      'vitamine D',
      'B12',
      'oméga-3',
    ],
    evictions: [],
    precaution_vocab: { ...PRECAUTION_VOCAB_BASE },
  },

  // ─── ADOLESCENTE (<18 ans, warning trouble alimentaire) ───────────────
  adolescente: {
    profile_key: 'adolescente',
    display_name: 'Adolescente (<18 ans)',
    forbidden_phrases: [
      ...FORBIDDEN_MEDICAL_VERBS,
      ...FORBIDDEN_REPLACE_MEDIC,
      'déficit calorique',
      'compter les calories',
      'restriction',
      'régime',
      'perdre du poids',
      'mincir',
      'sauter un repas',
      'jeûne',
    ],
    required_phrases: [],
    micronutrients: [
      'calcium',
      'fer',
      'zinc',
      'vitamine D',
    ],
    evictions: [],
    precaution_vocab: {
      ...PRECAUTION_VOCAB_BASE,
      'régime': 'rééquilibrage alimentaire',
      'restriction': 'choix conscient',
    },
  },

  // ─── MÉNOPAUSE (peri / post) ──────────────────────────────────────────
  menopause: {
    profile_key: 'menopause',
    display_name: 'Ménopause',
    forbidden_phrases: [
      ...FORBIDDEN_MEDICAL_VERBS,
      ...FORBIDDEN_REPLACE_MEDIC,
      ...FORBIDDEN_REPLACE_SUPPLEMENTATION,
      'œstrogènes naturels',
      'remplace ton traitement hormonal',
      'guérir les bouffées',
    ],
    required_phrases: [],
    micronutrients: [
      'calcium',
      'vitamine D',
      'magnésium',
      'oméga-3',
    ],
    evictions: [],
    precaution_vocab: { ...PRECAUTION_VOCAB_BASE },
  },

  // ─── DIABÈTE (type 1 et 2 — vigilance medic) ──────────────────────────
  diabete: {
    profile_key: 'diabete',
    display_name: 'Diabète',
    forbidden_phrases: [
      ...FORBIDDEN_MEDICAL_VERBS,
      ...FORBIDDEN_REPLACE_MEDIC,
      ...FORBIDDEN_REPLACE_SUPPLEMENTATION,
      'éviter tes injections',
      'remplace ton insuline',
      'arrête ta metformine',
      'guérir le diabète',
      'inverser le diabète sans suivi médical',
    ],
    required_phrases: [
      'en coordination avec ton médecin',
    ],
    micronutrients: [
      'magnésium',
      'chrome',
      'vitamine D',
      'oméga-3',
    ],
    evictions: [
      'sucres rapides en excès',
    ],
    precaution_vocab: { ...PRECAUTION_VOCAB_BASE },
  },

  // ─── PATHOLOGIES CRITIQUES — fallback générique ───────────────────────
  pathologieCritique: {
    profile_key: 'pathologieCritique',
    display_name: 'Pathologie chronique critique',
    forbidden_phrases: [
      ...FORBIDDEN_MEDICAL_VERBS,
      ...FORBIDDEN_REPLACE_MEDIC,
      ...FORBIDDEN_REPLACE_SUPPLEMENTATION,
    ],
    required_phrases: [
      'en complément du suivi médical',
    ],
    micronutrients: [],
    evictions: [],
    precaution_vocab: { ...PRECAUTION_VOCAB_BASE },
  },
};

/**
 * Détecte les garde-fous applicables selon le profil et le form de la cliente.
 *
 * Phase 1 simple : si profile.tag === 'grossesse' OU tags contient 'grossesse'
 * → applique le guardrail grossesse. Pas de distinction trimestre en V1.
 *
 * @param {{ tag?: string, all?: string[] }} profile - Output de detectClientProfile
 * @param {object} form - L'anamnèse client (clients.form)
 * @returns {Guardrail[]} Tableau des garde-fous matchés (peut être vide)
 */
export function detectClinicalGuardrails(profile, form) {
  if (!profile) return [];
  const matched = [];
  const allTags = [profile.tag, ...(profile.all || [])].filter(Boolean);
  const f = form || {};

  // Grossesse : tag primaire OU dans la liste all (cumul avec pathologie)
  if (allTags.includes('grossesse')) {
    matched.push(GUARDRAILS_FR.grossesse);
  }

  // Allaitement
  if (allTags.includes('allaitement')) {
    matched.push(GUARDRAILS_FR.allaitement);
  }

  // Post-partum
  if (allTags.includes('postPartum')) {
    matched.push(GUARDRAILS_FR.postPartum);
  }

  // Adolescente <18 ans (depuis le form, pas le profile)
  const age = Number.parseInt(f.age || f.ageActuel || '', 10);
  if (Number.isFinite(age) && age > 0 && age < 18) {
    matched.push(GUARDRAILS_FR.adolescente);
  }

  // Ménopause (peri ou post)
  if (allTags.includes('menopause') || allTags.includes('perimenopause')) {
    matched.push(GUARDRAILS_FR.menopause);
  }

  // Diabète (T1 et T2)
  if (allTags.includes('diabete') || allTags.includes('complicationsDiabete')) {
    matched.push(GUARDRAILS_FR.diabete);
  }

  // Pathologies critiques (fallback générique) — si tags spécifiques
  const criticalTags = ['clostridiumDifficile', 'nephropathie', 'saos'];
  if (criticalTags.some((t) => allTags.includes(t))) {
    // Ne pas dupliquer si déjà couvert par un guardrail spécifique
    if (!matched.some((g) => g.profile_key === 'pathologieCritique')) {
      matched.push(GUARDRAILS_FR.pathologieCritique);
    }
  }

  return matched;
}

/**
 * Construit le bloc de prompt à injecter dans le composer pour transmettre
 * les contraintes au LLM. Phase 1 = phrases interdites + vocab précaution.
 *
 * Format texte structuré (pas markdown lourd, le LLM lit plus rapidement
 * des sections étiquetées en plain text).
 *
 * @param {Guardrail[]} guardrails
 * @returns {string} Bloc texte à concaténer dans le system prompt (ou '' si rien)
 */
export function buildGuardrailsBlockFr(guardrails) {
  if (!Array.isArray(guardrails) || guardrails.length === 0) return '';

  const lines = [];
  lines.push('// ═══ CONTRAINTES CLINIQUES NON-NÉGOCIABLES ═══');
  lines.push('');

  const profileNames = guardrails.map((g) => g.display_name).join(' + ');
  lines.push(`Profil(s) détecté(s) : ${profileNames}`);
  lines.push('');

  // Phrases interdites — agrégées (unique) à travers tous les guardrails
  const allForbidden = new Set();
  for (const g of guardrails) {
    for (const p of g.forbidden_phrases || []) allForbidden.add(p);
  }
  if (allForbidden.size > 0) {
    lines.push('À NE JAMAIS DIRE OU IMPLIQUER (formulations interdites, risque médico-légal) :');
    for (const phrase of allForbidden) {
      lines.push(`  - "${phrase}"`);
    }
    lines.push('');
  }

  // V97.x Phase 2 — Micronutriments obligatoirement nommés.
  const allMicros = new Set();
  for (const g of guardrails) {
    for (const m of g.micronutrients || []) allMicros.add(m);
  }
  if (allMicros.size > 0) {
    lines.push('À NOMMER OBLIGATOIREMENT (sources alimentaires + supplémentation si pertinent) :');
    for (const micro of allMicros) {
      lines.push(`  - ${micro}`);
    }
    lines.push('');
  }

  // V97.x Phase 2 — Évictions à mentionner.
  const allEvictions = new Set();
  for (const g of guardrails) {
    for (const e of g.evictions || []) allEvictions.add(e);
  }
  if (allEvictions.size > 0) {
    lines.push('À MENTIONNER dans la section éviction / risques :');
    for (const ev of allEvictions) {
      lines.push(`  - ${ev}`);
    }
    lines.push('');
  }

  // V97.x Phase 2 — Required phrases (formulations attendues).
  const allRequired = new Set();
  for (const g of guardrails) {
    for (const r of g.required_phrases || []) allRequired.add(r);
  }
  if (allRequired.size > 0) {
    lines.push('FORMULATIONS ATTENDUES (au moins une occurrence sémantique) :');
    for (const req of allRequired) {
      lines.push(`  - "${req}"`);
    }
    lines.push('');
  }

  // Vocab de précaution — substitutions obligatoires
  const allVocab = {};
  for (const g of guardrails) {
    Object.assign(allVocab, g.precaution_vocab || {});
  }
  const vocabKeys = Object.keys(allVocab);
  if (vocabKeys.length > 0) {
    lines.push('VOCABULAIRE OBLIGATOIRE (substitue à chaque occurrence) :');
    for (const k of vocabKeys) {
      lines.push(`  - "${k}" → "${allVocab[k]}"`);
    }
    lines.push('');
  }

  lines.push('Règle de scope : Anissa est PRATICIENNE EN NUTRITION, pas médecin. ');
  lines.push('Le plan accompagne ; il ne remplace JAMAIS un avis médical, une supplémentation prescrite, ');
  lines.push('ou un traitement en cours. Toujours formuler en complément, jamais en substitution.');
  lines.push('');
  lines.push('Si une recommandation paraît empiéter sur le rôle médical, reformule pour rester dans le scope nutritionnel.');

  return lines.join('\n');
}

/**
 * Audit post-génération : vérifie que le plan généré ne contient aucune
 * des phrases interdites. Retourne un tableau de violations détectées.
 *
 * @param {string} planText - Le plan nutrition généré par l'IA
 * @param {Guardrail[]} guardrails - Garde-fous actifs (issus de detectClinicalGuardrails)
 * @returns {Array<{ profile_key: string, phrase: string, snippet: string }>}
 *   Tableau vide si aucune violation. Sinon liste avec contexte (snippet de 80 char autour).
 */
export function auditPlanForGuardrails(planText, guardrails) {
  if (!planText || !Array.isArray(guardrails) || guardrails.length === 0) return [];

  const lowercasePlan = planText.toLowerCase();
  const violations = [];

  for (const guardrail of guardrails) {
    for (const phrase of guardrail.forbidden_phrases || []) {
      const lowercasePhrase = phrase.toLowerCase();
      let searchFrom = 0;
      while (searchFrom < lowercasePlan.length) {
        const idx = lowercasePlan.indexOf(lowercasePhrase, searchFrom);
        if (idx === -1) break;
        // Snippet 40 caractères avant + 40 après pour contexte
        const start = Math.max(0, idx - 40);
        const end = Math.min(planText.length, idx + phrase.length + 40);
        const snippet = planText.slice(start, end).replace(/\n/g, ' ').trim();
        violations.push({
          profile_key: guardrail.profile_key,
          phrase,
          snippet: `...${snippet}...`,
        });
        searchFrom = idx + phrase.length;
      }
    }
  }

  return violations;
}

/**
 * V97.x Phase 2 — Audit complétude : vérifie que les micronutriments
 * obligatoires + évictions sont bien mentionnés dans le plan généré.
 *
 * Logique : pour chaque guardrail, lister les items micronutrients + evictions
 * qui n'apparaissent PAS dans le planText (case-insensitive, match substring).
 *
 * @param {string} planText
 * @param {Guardrail[]} guardrails
 * @returns {{ missing_micronutrients: Array<{profile_key, item}>,
 *             missing_evictions: Array<{profile_key, item}>,
 *             missing_required_phrases: Array<{profile_key, phrase}> }}
 */
export function auditPlanCompleteness(planText, guardrails) {
  const result = {
    missing_micronutrients: [],
    missing_evictions: [],
    missing_required_phrases: [],
  };
  if (!planText || !Array.isArray(guardrails) || guardrails.length === 0) {
    return result;
  }
  const lowercasePlan = planText.toLowerCase();

  for (const guardrail of guardrails) {
    for (const micro of guardrail.micronutrients || []) {
      // Match : si le nom du micro (ou son alias court) apparait dans le plan
      const micros = micro.toLowerCase().split(/[\s/]+/).filter((w) => w.length > 2);
      // Au moins un mot significatif du nom doit être dans le plan
      const found = micros.some((w) => lowercasePlan.includes(w));
      if (!found) {
        result.missing_micronutrients.push({
          profile_key: guardrail.profile_key,
          item: micro,
        });
      }
    }

    for (const eviction of guardrail.evictions || []) {
      // Match : nom court de l'éviction dans le plan
      const keyWord = eviction.toLowerCase().split(/[\s(]+/)[0];
      if (keyWord.length < 3) continue;
      if (!lowercasePlan.includes(keyWord)) {
        result.missing_evictions.push({
          profile_key: guardrail.profile_key,
          item: eviction,
        });
      }
    }

    for (const phrase of guardrail.required_phrases || []) {
      // Match sémantique simple : au moins 2 mots significatifs présents
      const words = phrase.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const foundCount = words.filter((w) => lowercasePlan.includes(w)).length;
      if (foundCount < Math.min(2, words.length)) {
        result.missing_required_phrases.push({
          profile_key: guardrail.profile_key,
          phrase,
        });
      }
    }
  }

  return result;
}
