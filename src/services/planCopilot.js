// ═══════════════════════════════════════════════════════════════════════
// V79 — AI Plan Copilot : routing + insertion d'une quickWin dans le plan
//
// MVP minimal : route une suggestion vers UNE des 4 sections cibles
// (protocoles, ajustements, recommandations coach, plan d'action),
// puis l'injecte proprement en bullet a la fin de la section.
//
// Contraintes :
//   - pas de reecriture du plan
//   - pas d'ecrasement du contenu existant
//   - retour NULL si la section cible n'est pas trouvee (toast erreur cote UI)
//   - idempotent : si la suggestion existe deja (match substring), skip
// ═══════════════════════════════════════════════════════════════════════

// Mapping keyword → section type (priorite : le premier match gagne)
// Les regex sont ordonnees du plus specifique au plus generique.
const ROUTING_RULES = [
  // Plan d'action (timeline S1→S4) — tres specifique, match en premier
  { type: 'action', test: /\b(?:s[1-4]\b|semaine\s*[1-4]\b|phase\s*[1-4]|timeline|progression\s*s[1-4]|plan\s*d.?action|etape\s*[1-4])/i },

  // Ajustements environnementaux — stress / sommeil / mode de vie
  { type: 'adjustments', test: /\b(?:stress|sommeil|endormissement|respiration|meditation|ecran|bleu|lumiere|coucher|tempsexter|marche|mouvement|exposition\s*soleil|vitamine\s*d.*soleil|cortisol|circadien|melatonine|anti-?stress|relaxation|yoga|pranayama)/i },

  // Recommandations coach — conseils comportementaux, habitudes, mentalite
  { type: 'coach', test: /\b(?:adherence|motivation|habitude|routine|rituel|conseil|rappel|astuce|pedagog|encourage|regulier|perseverance|discipline|gestion\s*fringale|psychologie|stagnation|pese[er]?|balance|self)/i },

  // Protocoles cibles — cliniques, nutritionnels, supplementation
  { type: 'protocol', test: /\b(?:glycemi|insulin|proteine|fibre|portion|gramme|micronutri|ferritine|mag(?:nesium)?|zinc|vit(?:amine)?\s*[a-k]|omega|curcuma|probiotique|L-glutamine|inositol|chrome|fer|coQ10|selenium|iode|chrome|bisglycinate|repa|dejeuner|diner|petit-?dej|collation|hydratat|eau\s*entre|mastic|cruciferace|cetogene|mediterraneen|macro|indexglyce|ig\s*bas|charge\s*glyce|glucide|lipide|matiere\s*grasse|legume\s*vapeur|vapeur|cuisson|cru|inflammatoire|anti-?inflammatoire|detox|bouillon|os\s*maison|probio|microbiote|intestin|digestion|ballonnement|transit|absorption)/i },
];

// Normalise le texte pour le routing : minuscules + accents strippes
// → permet a "Pèse-toi" de matcher "pese", "spécialisée" de matcher "specialis", etc.
function normalizeForRouting(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Detecte la section cible d'une suggestion.
 * @param {string} winText
 * @returns {'protocol'|'adjustments'|'coach'|'action'|null}
 */
export function routeQuickWin(winText) {
  if (!winText || typeof winText !== 'string') return null;
  const text = winText.trim();
  if (text.length < 3) return null;
  const normalized = normalizeForRouting(text);
  for (const rule of ROUTING_RULES) {
    if (rule.test.test(normalized)) return rule.type;
  }
  return null;
}

// Regex pour detecter les headers de sections cibles
// Important : ordre par specificite — "plan d'action" avant "action" seule, etc.
const SECTION_HEADER_PATTERNS = {
  protocol: /^#{0,4}\s*(?:protocoles?(\s*cibl[eé]s?)?|protocole)\b/i,
  adjustments: /^#{0,4}\s*ajustements?(\s*environnementaux)?\b/i,
  coach: /^#{0,4}\s*recommandations?(\s*coach)?\b/i,
  action: /^#{0,4}\s*plan\s*d.?action\b|^#{0,4}\s*plan\s*d.?actions?\s*\(/i,
};

// Match : est-ce une ligne qui ouvre une AUTRE section ?
function isAnotherSectionHeader(line, currentType) {
  const t = line.trim();
  if (!t) return false;
  // Markdown header
  if (/^#{1,4}\s+/.test(t)) return true;
  // ALL CAPS label, assez long, sans prefixe numerique
  const allCaps = t === t.toUpperCase() && /[A-ZÀ-Ü]/.test(t);
  if (allCaps && t.length >= 6 && t.length < 80 && !/^\d/.test(t)) {
    // Sauf si c'est la section courante elle-meme
    if (currentType && SECTION_HEADER_PATTERNS[currentType].test(t)) return false;
    return true;
  }
  return false;
}

/**
 * Normalise une suggestion pour l'inserer comme bullet.
 * Strip prefixe "- ", markdown gras, ponctuation finale ambigue.
 */
function normalizeBullet(text) {
  return text
    .trim()
    .replace(/^[-–•*]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Insere une quickWin dans la section cible d'un plan markdown.
 *
 * @param {string} planText - Le texte du plan complet (markdown)
 * @param {string} winText - La suggestion a inserer
 * @returns {{ok: true, newPlan: string, type: string, duplicate?: boolean} | {ok: false, reason: string}}
 */
export function insertWinIntoPlan(planText, winText) {
  const type = routeQuickWin(winText);
  if (!type) {
    return { ok: false, reason: 'no_route' };
  }
  if (!planText || typeof planText !== 'string') {
    return { ok: false, reason: 'no_plan' };
  }

  const bullet = normalizeBullet(winText);
  if (bullet.length < 3) {
    return { ok: false, reason: 'too_short' };
  }

  const lines = planText.split('\n');
  const headerPattern = SECTION_HEADER_PATTERNS[type];

  // Trouver l'index du header de la section cible
  let sectionHeaderIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i].trim())) {
      sectionHeaderIdx = i;
      break;
    }
  }

  if (sectionHeaderIdx === -1) {
    return { ok: false, reason: 'section_not_found' };
  }

  // Trouver la fin de la section (premiere ligne qui ouvre une autre section, ou EOF)
  let sectionEndIdx = lines.length;
  for (let i = sectionHeaderIdx + 1; i < lines.length; i++) {
    if (isAnotherSectionHeader(lines[i], type)) {
      sectionEndIdx = i;
      break;
    }
  }

  // Extraire le contenu de la section
  const sectionContent = lines.slice(sectionHeaderIdx + 1, sectionEndIdx).join('\n');

  // Check duplicate : est-ce que la suggestion est deja presente ?
  const normalizedExisting = sectionContent.toLowerCase();
  const normalizedBullet = bullet.toLowerCase();
  // Comparaison lache : considere duplicate si >70% des mots du bullet apparaissent
  // Evite faux negatifs sur les rephrasings
  const bulletWords = normalizedBullet.split(/\s+/).filter(w => w.length > 3);
  if (bulletWords.length > 0) {
    const matchCount = bulletWords.filter(w => normalizedExisting.includes(w)).length;
    if (matchCount / bulletWords.length > 0.75 && normalizedExisting.includes(normalizedBullet.slice(0, 20))) {
      return { ok: false, reason: 'duplicate' };
    }
  }

  // Insertion : on cherche le dernier contenu non-vide avant sectionEndIdx
  // et on insere le bullet juste apres, avec un espacement propre.
  let insertAt = sectionEndIdx;
  // Reculer sur les lignes vides en fin de section
  while (insertAt > sectionHeaderIdx + 1 && !lines[insertAt - 1].trim()) {
    insertAt--;
  }

  const newLine = `- ${bullet}`;
  // Inserer la ligne + preserver les lignes vides suivantes s'il y en avait
  const newLines = [
    ...lines.slice(0, insertAt),
    newLine,
    ...lines.slice(insertAt),
  ];

  return {
    ok: true,
    newPlan: newLines.join('\n'),
    type,
  };
}

/**
 * Label d'affichage pour un type de section.
 */
export function sectionLabel(type) {
  return {
    protocol: 'Protocoles ciblés',
    adjustments: 'Ajustements environnementaux',
    coach: 'Recommandations coach',
    action: "Plan d'action",
  }[type] || type;
}

/**
 * Message d'erreur humain pour une raison d'echec.
 */
export function failureMessage(reason) {
  return {
    no_route: 'Aucune section cible détectée pour cette suggestion',
    no_plan: 'Aucun plan à modifier',
    too_short: 'Suggestion trop courte',
    section_not_found: 'Section cible absente du plan — à créer manuellement',
    duplicate: 'Cette suggestion semble déjà présente',
  }[reason] || 'Insertion échouée';
}
