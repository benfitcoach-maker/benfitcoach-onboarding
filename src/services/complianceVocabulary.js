// ─────────────────────────────────────────────────────────────────
// Compliance — Vocabulary layer (forbidden terms + sanitizer)
// Date : 2026-05-11
//
// Couche d'infrastructure systémique pour s'assurer qu'aucune génération
// IA, aucun texte UI, aucun export ne glisse vers du vocabulaire
// pseudo-diagnostique ou médical décisionnel.
//
// Le positionnement produit est :
//   "Plateforme d'accompagnement nutritionnel fonctionnel
//    supervisée par une nutritionniste."
//
// Donc :
//   - L'IA ne "détecte", ne "diagnostique", ne "traite" jamais
//   - Elle "signale", "lit", "accompagne", "propose"
//
// Cette couche est :
//   - Utilisée dans le prompt safety wrapper (services/anthropic.js)
//   - Utilisée par SafeText component (UI)
//   - Utilisée par exportToWord (PDF)
//
// ⚠️ Liste à enrichir progressivement à partir des cas réels rencontrés.
// ─────────────────────────────────────────────────────────────────

/**
 * Map { terme_interdit_regex : remplacement }
 * Insensible à la casse, préserve la capitalisation initiale du match.
 *
 * Les regex utilisent des word boundaries (\b) pour éviter les
 * faux-positifs (ex: "détecte" ne doit pas matcher "détecter").
 *
 * Chaque entrée doit garder un sens pédagogique pour la cliente.
 */
export const FORBIDDEN_TERMS = [
  // ─── Vocabulaire diagnostique ──────────────────────────────────
  { pattern: /\bdétecte(?:r|s|nt|z|rais?|raient?|riez?|rons|rez)?\b/gi, replacement: 'signale' },
  { pattern: /\bdétection\b/gi, replacement: 'lecture clinique' },
  { pattern: /\bdétecté(?:e|s|es)?\b/gi, replacement: 'observé' },
  { pattern: /\bdiagnostic(?:s|ation|s)?\b/gi, replacement: 'lecture clinique' },
  { pattern: /\bdiagnostiquer?\b/gi, replacement: 'identifier' },
  { pattern: /\bdiagnostiqué(?:e|s|es)?\b/gi, replacement: 'observé' },

  // ─── Vocabulaire pathologique ──────────────────────────────────
  { pattern: /\bmaladie(?:s)?\b/gi, replacement: 'déséquilibre' },
  { pattern: /\bpathologie(?:s)?\b/gi, replacement: 'terrain' },
  { pattern: /\bpathologique(?:s|ment)?\b/gi, replacement: 'fonctionnel' },

  // ─── Vocabulaire thérapeutique ─────────────────────────────────
  { pattern: /\btraitement(?:s)?\b/gi, replacement: 'accompagnement' },
  { pattern: /\btraiter?\b/gi, replacement: 'accompagner' },
  { pattern: /\btraité(?:e|s|es)?\b/gi, replacement: 'accompagné' },
  { pattern: /\bthérapie(?:s)?\b/gi, replacement: 'protocole nutritionnel' },
  { pattern: /\bthérapeutique(?:s|ment)?\b/gi, replacement: 'nutritionnel' },
  { pattern: /\bguéri(?:r|t|s|ssent|ssons)?\b/gi, replacement: 'soutenir' },
  { pattern: /\bguérison(?:s)?\b/gi, replacement: 'rétablissement' },

  // ─── Vocabulaire prédictif / risque médical ───────────────────
  { pattern: /\brisque(?:s)? pathologique(?:s)?\b/gi, replacement: 'tendance fonctionnelle' },
  { pattern: /\brisque(?:s)? médical(?:e|aux|es)?\b/gi, replacement: 'vigilance' },
  { pattern: /\bprédispose\b/gi, replacement: 'peut moduler' },
  { pattern: /\bprédisposé(?:e|s|es)?\b/gi, replacement: 'avec une tendance' },

  // ─── Affirmations médicales fortes ────────────────────────────
  { pattern: /\bcause(?:s)? (?:de|d')\b/gi, replacement: 'facteur(s) associé(s) à' },
  { pattern: /\bsoign(?:e|er|é|ée|és|ées|ent)\b/gi, replacement: 'accompagne' },
];

/**
 * Sanitize un texte : remplace tous les termes interdits par leur
 * équivalent fonctionnel. Préserve la capitalisation du premier match.
 *
 * @param {string} input - texte à nettoyer
 * @returns {string} texte sanitizé
 */
export function sanitizeText(input) {
  if (!input || typeof input !== 'string') return input;
  let output = input;
  for (const { pattern, replacement } of FORBIDDEN_TERMS) {
    output = output.replace(pattern, (match) => {
      // Préserve la capitalisation initiale
      if (match[0] === match[0].toUpperCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }
  return output;
}

/**
 * Audite un texte : retourne la liste des termes risqués trouvés.
 * Utile en mode dev pour repérer les zones à corriger.
 *
 * @param {string} input - texte à analyser
 * @returns {Array<{term: string, replacement: string, occurrences: number}>}
 */
export function auditText(input) {
  if (!input || typeof input !== 'string') return [];
  const findings = [];
  for (const { pattern, replacement } of FORBIDDEN_TERMS) {
    // Reset lastIndex car le pattern est global
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = input.match(regex);
    if (matches && matches.length > 0) {
      findings.push({
        term: matches[0],
        replacement,
        occurrences: matches.length,
      });
    }
  }
  return findings;
}

/**
 * Construit le bloc d'instructions à injecter dans le system prompt
 * des appels IA. Garantit que GPT/Claude utilise le bon vocabulaire
 * à la source plutôt que de devoir tout sanitizer en sortie.
 *
 * À injecter via le prompt safety wrapper (services/anthropic.js).
 */
export const SYSTEM_PROMPT_VOCABULARY_GUARD = `
RÈGLES DE VOCABULAIRE CLINIQUE OBLIGATOIRES (positionnement nutritionnel fonctionnel supervisé, pas dispositif médical) :

- N'utilise JAMAIS : "détecte", "diagnostique", "maladie", "pathologie", "traitement", "thérapie", "guérir", "risque pathologique", "prédispose à", "cause de" (au sens médical).
- Utilise PLUTÔT : "signale", "lecture clinique", "déséquilibre", "terrain", "accompagnement", "protocole nutritionnel", "soutenir", "tendance", "facteur associé à".
- Formulations sûres : "profil compatible avec...", "signaux convergents vers...", "tendance fonctionnelle de...", "axe nutritionnel à soutenir...".
- Pour les données génétiques : toujours "certaines variations peuvent moduler...", "tendance possible...", JAMAIS "vous êtes prédisposé".
- Aucune affirmation diagnostique. Aucune promesse de résultat médical. Le texte généré est destiné à être validé par la nutritionniste avant transmission à la cliente.
`.trim();

/**
 * Vérifie qu'un texte respecte les règles de vocabulaire.
 * Utile pour tests / CI.
 *
 * @returns {boolean} true si aucun terme risqué détecté
 */
export function isVocabularyCompliant(input) {
  return auditText(input).length === 0;
}
