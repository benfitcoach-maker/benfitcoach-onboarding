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

/**
 * Garde-fous PHASE 1 — hardcode JS, focalisé phrases interdites grossesse.
 * Phase 2 = migration table Supabase + matrice complète 7 profils.
 *
 * @type {Record<string, Guardrail>}
 */
export const GUARDRAILS_FR = {
  grossesse: {
    profile_key: 'grossesse',
    display_name: 'Grossesse',
    forbidden_phrases: [
      // Phrases promettant d'éviter une intervention médicale
      'éviter tes injections',
      'éviter les injections',
      'éviter ton injection',
      'évite tes injections',
      'éviter les injections annuelles',
      'remplacer tes injections',
      'remplace tes injections',
      // Phrases contredisant la supplémentation médicale
      'plus efficace que les comprimés',
      'plus efficace que tes comprimés',
      'plus efficace que ta supplémentation',
      'remplace tes comprimés',
      'remplacer tes comprimés',
      'à la place de tes comprimés',
      'à la place de ta supplémentation',
      'à la place du fer prescrit',
      // Phrases qui empiètent sur le rôle médical
      'à la place du médecin',
      'à la place de ton médecin',
      'remplacer le médecin',
      'remplace ton médecin',
      'tu n\'as pas besoin de médecin',
      'sans avis médical',
      'arrête ton traitement',
      'arrête tes médicaments',
      // Verbes médicaux interdits (scope nutritionniste strict)
      'guérir',
      'guérit',
      'soigner ta',
      'soigner ton',
      'traiter ta',
      'traiter ton',
      'diagnostiquer',
    ],
    required_phrases: [], // Phase 2 : exigences ex "éviter listeria"
    micronutrients: [], // Phase 2 : iode / B9 / fer / etc.
    evictions: [], // Phase 2 : listeria / toxoplasmose / mercure / alcool
    precaution_vocab: {
      'à la place de': 'en complément de',
      'remplace': 'complète',
      'au lieu de prendre': 'en plus de prendre',
    },
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
export function detectClinicalGuardrails(profile, _form) {
  if (!profile) return [];
  const matched = [];
  const allTags = [profile.tag, ...(profile.all || [])].filter(Boolean);

  // Grossesse : tag primaire OU dans la liste all (cumul avec pathologie)
  if (allTags.includes('grossesse')) {
    matched.push(GUARDRAILS_FR.grossesse);
  }

  // Phase 2 : ajouter ici allaitement, postPartum, adolescente, ménopause,
  // pathologies critiques (diabete T1, IR sévère, etc.)

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
