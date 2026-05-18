// ─── _antiSlop.fr.js ──────────────────────────────────────────────────
// V97.x Phase 3 — Détection heuristique des patterns "AI-flavored" dans
// les plans nutritionnels générés. Cf spec composer-v97-clinical-antislop.
//
// 7 catégories de détection :
//   1. Rule of three forcé (3 substantifs + "et" dans titre/sous-titre)
//   2. Vocab AI bag-of-words (protocole de base, timing adapté, etc.)
//   3. Métaphores cliché (montagnes russes glycémiques, etc.)
//   4. Pattern visuel symétrique (3+ sections format identique)
//   5. Bullets parallèles trop propres (Matin/Midi/Soir)
//   6. Titres composer "X > Y" en MAJUSCULES
//   7. Excès majuscules titre > 30 caractères
//
// Output : tableau de flags { id, category, severity, line, snippet,
// suggestion, location }. severity ∈ 'low' | 'medium' | 'high'.
//
// Aucun LLM, 100% regex + structure. Déterministe, instantané, testable.
// Phase 4 (LLM ciblé) reformulera les sections flaggées.

/**
 * @typedef {object} SlopFlag
 * @property {string} id - Identifiant unique du flag (pour clés React et dédup)
 * @property {'rule_of_three'|'ai_vocab'|'cliche'|'symmetric_sections'|'parallel_bullets'|'title_chevron'|'excess_caps'} category
 * @property {'low'|'medium'|'high'} severity
 * @property {string} snippet - Le passage problématique (max 120 char)
 * @property {string} reason - Raison du flag (lisible Anissa)
 * @property {string} [suggestion] - Suggestion brève de reformulation
 * @property {number} [lineIndex] - 0-based index de la ligne dans planText
 */

// ─── Vocab AI bag-of-words ───────────────────────────────────────────────

const AI_VOCAB_PHRASES = [
  'protocole de base',
  'timing adapté',
  'timing adapte',
  'axe prioritaire',
  'indicateurs hebdomadaires',
  'ajustements selon',
  'dans une démarche',
  'dans une demarche',
  'de manière optimale',
  'de maniere optimale',
  'de façon ciblée',
  'de facon ciblee',
  'il est essentiel de',
  'il convient de noter',
  'mettre en place',
  'mise en place',
  'piliers fondamentaux',
  'leviers prioritaires',
  'approche holistique',
  'optimisation continue',
];

// ─── Métaphores cliché ──────────────────────────────────────────────────

const CLICHE_METAPHORS = [
  'montagnes russes glycémiques',
  'montagnes russes glycemiques',
  'la base est posée',
  'la base est posee',
  'tout ce dont',
  'période intense',
  'periode intense',
  'voyage nutritionnel',
  'boussole alimentaire',
  'pierre angulaire',
  'socle solide',
  'pilier central',
  'fil rouge',
  'tableau de bord',
];

// ─── Bullets parallèles types ───────────────────────────────────────────

const PARALLEL_BULLET_PATTERNS = [
  /^[\s•\-*]*\s*(matin|midi|soir|nuit)\s*[:\-—]/i,
  /^[\s•\-*]*\s*(pré|pre|post|pendant|avant|apres|après)[\-\s]/i,
  /^[\s•\-*]*\s*(petit[\s-]?déjeuner|déjeuner|d[ée]jeuner|dejeuner|diner|dîner|collation)\s*[:\-—]/i,
  /^[\s•\-*]*\s*(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*[:\-—]/i,
];

// ─── Helpers ────────────────────────────────────────────────────────────

function makeId(category, lineIdx, extra) {
  return `${category}-${lineIdx}-${(extra || '').slice(0, 16).replace(/\s/g, '_')}`;
}

function snippetOf(line, maxLen = 120) {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  return cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, maxLen - 3)}...`;
}

// ─── Détecteurs individuels ─────────────────────────────────────────────

/** Détecte rule-of-three : "A, B et C" / "A, B, C" dans titre ou phrase courte */
function detectRuleOfThree(line, lineIdx) {
  // Pattern : 3 substantifs séparés par virgules, dernier précédé de "et"
  // ex : "Stabilité glycémique, gestion du stress et soutien grossesse"
  const ruleOfThreeRegex = /([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,3}),\s+([A-ZÀ-Ýa-zà-ÿ][a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,3}),?\s+et\s+([A-ZÀ-Ýa-zà-ÿ][a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,3})/;
  const match = line.match(ruleOfThreeRegex);
  if (!match) return null;
  // Severity haute si dans un titre (ligne courte sans ponctuation)
  const isTitle = line.length < 100 && !line.includes('.');
  return {
    id: makeId('rule_of_three', lineIdx, match[0]),
    category: 'rule_of_three',
    severity: isTitle ? 'high' : 'medium',
    snippet: snippetOf(line),
    reason: 'Rule of three : 3 items énumérés avec "et" final (pattern AI très visible).',
    suggestion: 'Reformule en 1-2 axes principaux ou laisse couler en prose.',
    lineIndex: lineIdx,
  };
}

/** Détecte vocab AI bag-of-words */
function detectAIVocab(line, lineIdx) {
  const lowerLine = line.toLowerCase();
  const matched = AI_VOCAB_PHRASES.filter((v) => lowerLine.includes(v));
  if (matched.length === 0) return null;
  const severity = matched.length >= 2 ? 'medium' : 'low';
  return {
    id: makeId('ai_vocab', lineIdx, matched.join('+')),
    category: 'ai_vocab',
    severity,
    snippet: snippetOf(line),
    reason: `Vocab AI détecté : ${matched.map((m) => `"${m}"`).join(', ')}.`,
    suggestion: 'Remplace par formulation directe ("je propose", "concrètement", "ici").',
    lineIndex: lineIdx,
  };
}

/** Détecte métaphores cliché */
function detectCliche(line, lineIdx) {
  const lowerLine = line.toLowerCase();
  const matched = CLICHE_METAPHORS.filter((c) => lowerLine.includes(c));
  if (matched.length === 0) return null;
  return {
    id: makeId('cliche', lineIdx, matched[0]),
    category: 'cliche',
    severity: 'high',
    snippet: snippetOf(line),
    reason: `Métaphore cliché : ${matched.map((m) => `"${m}"`).join(', ')}.`,
    suggestion: 'Supprime ou remplace par une description concrète.',
    lineIndex: lineIdx,
  };
}

/** Détecte titres "X > Y" en MAJUSCULES (format composer) */
function detectTitleChevron(line, lineIdx) {
  const chevronTitleRegex = /^[A-ZÀ-Ý][A-ZÀ-Ý\s]{2,}>\s*[A-ZÀ-Ý][A-ZÀ-Ý\s]+/;
  if (!chevronTitleRegex.test(line.trim())) return null;
  return {
    id: makeId('title_chevron', lineIdx),
    category: 'title_chevron',
    severity: 'medium',
    snippet: snippetOf(line),
    reason: 'Titre "X > Y" en MAJUSCULES (format technique composer visible).',
    suggestion: 'Passe en casse normale : "X — Y" ou simple titre.',
    lineIndex: lineIdx,
  };
}

/** Détecte excès majuscules dans titre > 30 caractères */
function detectExcessCaps(line, lineIdx) {
  const trimmed = line.trim();
  if (trimmed.length <= 30) return null;
  // Ratio capitales hors espaces/ponctuation
  const letters = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length === 0) return null;
  const caps = trimmed.replace(/[^A-ZÀ-Ý]/g, '').length;
  const ratio = caps / letters.length;
  if (ratio < 0.85) return null;
  return {
    id: makeId('excess_caps', lineIdx),
    category: 'excess_caps',
    severity: 'low',
    snippet: snippetOf(line),
    reason: `Titre entièrement en MAJUSCULES (${trimmed.length} char).`,
    suggestion: 'Passe en casse normale avec capitale initiale uniquement.',
    lineIndex: lineIdx,
  };
}

/** Détecte 3+ bullets parallèles consécutifs (Matin/Midi/Soir, etc.) */
function detectParallelBullets(lines, startIdx) {
  // Cherche 3 lignes consécutives matchant le même type de pattern parallèle
  for (const pattern of PARALLEL_BULLET_PATTERNS) {
    let count = 0;
    let firstMatch = -1;
    for (let i = startIdx; i < Math.min(startIdx + 6, lines.length); i++) {
      if (pattern.test(lines[i])) {
        if (count === 0) firstMatch = i;
        count++;
      } else if (lines[i].trim().length > 0) {
        // Ligne non vide qui rompt le pattern → reset
        break;
      }
    }
    if (count >= 3) {
      return {
        id: makeId('parallel_bullets', firstMatch, pattern.source),
        category: 'parallel_bullets',
        severity: 'medium',
        snippet: snippetOf(lines.slice(firstMatch, firstMatch + count).join(' | ')),
        reason: `${count} bullets parallèles consécutifs avec même structure.`,
        suggestion: 'Fusionne en prose ou casse le rythme (un bullet plus long, un plus court).',
        lineIndex: firstMatch,
      };
    }
  }
  return null;
}

/** Détecte sections symétriques (3+ avec format identique) */
function detectSymmetricSections(planText) {
  const lines = planText.split('\n');
  // Identifie les titres (MAJUSCULES, > 5 caractères, ratio capitales > 0.7)
  const titleIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length < 5 || t.length > 80) continue;
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letters.length === 0) continue;
    const caps = t.replace(/[^A-ZÀ-Ý]/g, '').length;
    if (caps / letters.length > 0.7) {
      titleIndices.push(i);
    }
  }

  // Pour chaque titre, compte les bullets sous (lignes commençant par - * • non vides)
  const sections = titleIndices.map((titleIdx, sectionIdx) => {
    const nextTitleIdx = titleIndices[sectionIdx + 1] || lines.length;
    let bulletCount = 0;
    for (let j = titleIdx + 1; j < nextTitleIdx; j++) {
      if (/^[\s]*[-*•]/.test(lines[j])) bulletCount++;
    }
    return { titleIdx, bulletCount };
  });

  // Cherche 3+ sections consécutives avec même bulletCount
  let streakStart = -1;
  let streakCount = 0;
  let streakBullets = 0;
  for (let i = 0; i < sections.length; i++) {
    if (i === 0 || sections[i].bulletCount !== sections[i - 1].bulletCount || sections[i].bulletCount === 0) {
      if (streakCount >= 3) {
        return {
          id: makeId('symmetric_sections', sections[streakStart].titleIdx),
          category: 'symmetric_sections',
          severity: 'high',
          snippet: `${streakCount} sections consécutives avec ${streakBullets} bullets chacune`,
          reason: 'Pattern visuel symétrique : sections de structure identique (AI deck flavor).',
          suggestion: 'Casse la symétrie : une section en prose, une avec 2 bullets, une avec 4.',
          lineIndex: sections[streakStart].titleIdx,
        };
      }
      streakStart = i;
      streakCount = 1;
      streakBullets = sections[i].bulletCount;
    } else {
      streakCount++;
    }
  }
  // Check final streak
  if (streakCount >= 3) {
    return {
      id: makeId('symmetric_sections', sections[streakStart].titleIdx),
      category: 'symmetric_sections',
      severity: 'high',
      snippet: `${streakCount} sections consécutives avec ${streakBullets} bullets chacune`,
      reason: 'Pattern visuel symétrique : sections de structure identique (AI deck flavor).',
      suggestion: 'Casse la symétrie : une section en prose, une avec 2 bullets, une avec 4.',
      lineIndex: sections[streakStart].titleIdx,
    };
  }
  return null;
}

// ─── API publique ───────────────────────────────────────────────────────

/**
 * Lance le pipeline anti-slop heuristique sur un plan généré.
 *
 * @param {string} planText
 * @returns {SlopFlag[]} Tableau de flags (peut être vide). Triés par lineIndex.
 */
export function detectSlopHeuristics(planText) {
  if (!planText || typeof planText !== 'string') return [];

  const lines = planText.split('\n');
  const flags = [];
  const seenIds = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Détecteurs ligne-par-ligne
    for (const detector of [detectRuleOfThree, detectAIVocab, detectCliche, detectTitleChevron, detectExcessCaps]) {
      const flag = detector(line, i);
      if (flag && !seenIds.has(flag.id)) {
        flags.push(flag);
        seenIds.add(flag.id);
      }
    }

    // Détecteur de séquence : bullets parallèles
    const parallelFlag = detectParallelBullets(lines, i);
    if (parallelFlag && !seenIds.has(parallelFlag.id)) {
      flags.push(parallelFlag);
      seenIds.add(parallelFlag.id);
    }
  }

  // Détecteur global : sections symétriques
  const symFlag = detectSymmetricSections(planText);
  if (symFlag && !seenIds.has(symFlag.id)) {
    flags.push(symFlag);
  }

  // Tri par lineIndex puis severity (high > medium > low)
  const severityOrder = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => {
    if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return flags;
}

/**
 * Aggrège les flags par catégorie pour affichage compact UI.
 *
 * @param {SlopFlag[]} flags
 * @returns {{ category: string, count: number, severity: string }[]}
 */
export function summarizeSlopFlags(flags) {
  const map = new Map();
  for (const f of flags) {
    const existing = map.get(f.category);
    if (existing) {
      existing.count++;
      // Garde la plus haute severity
      const sevOrder = { high: 0, medium: 1, low: 2 };
      if (sevOrder[f.severity] < sevOrder[existing.severity]) {
        existing.severity = f.severity;
      }
    } else {
      map.set(f.category, { category: f.category, count: 1, severity: f.severity });
    }
  }
  return Array.from(map.values());
}

/**
 * Labels lisibles pour les catégories (UI).
 */
export const CATEGORY_LABELS = {
  rule_of_three: 'Rule of three',
  ai_vocab: 'Vocab AI',
  cliche: 'Métaphore cliché',
  symmetric_sections: 'Sections symétriques',
  parallel_bullets: 'Bullets parallèles',
  title_chevron: 'Titre "X > Y"',
  excess_caps: 'Excès majuscules',
};
