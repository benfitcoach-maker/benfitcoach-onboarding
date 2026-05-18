// ─── rewriteSlopSection.js ─────────────────────────────────────────────
// V97.x Phase 4 — Reformulation LLM ciblée d'un passage flagé anti-slop.
//
// Cf spec : spec-composer-v97-clinical-antislop.md
//
// Principe : pour chaque flag détecté par detectSlopHeuristics (Phase 3),
// envoyer à Claude Haiku (économique) un prompt court qui reformule
// uniquement ce passage. Le LLM ne touche pas le reste.
//
// Voix de référence : chaleureuse, directe, tutoyante, sans jargon AI.
// Exemple : "Si tu poses ça, tu vas sentir la différence en 4-5 jours."
//
// Le résultat est stocké en state local par le caller, puis si Anissa
// accepte, replace la ligne dans le planText et persiste en
// editorial_overrides.slop_suggestions JSONB sur la consultation courante.

import { callClaude } from './anthropic';

const VOICE_REFERENCE = `Voix de référence : chaleureuse, directe, tutoyante, sans jargon corporate.
Exemple : "Si tu poses ça, tu vas sentir la différence en 4-5 jours sur les fringales."
Autre exemple : "Trois choses ressortent : ton transit n'est pas régulier, tu te lèves fatiguée, ton stress monte le mardi. On va travailler là-dessus simplement."`;

/**
 * Reformule un passage flagé anti-slop via LLM Haiku ciblé.
 *
 * @param {object} args
 * @param {string} args.passage - Le texte original à reformuler (ligne complète typiquement)
 * @param {Array<{ category: string, reason: string }>} args.flags - Flags détectés sur ce passage
 * @param {string} [args.model] - Override modèle (default haiku)
 * @returns {Promise<{ ok: boolean, rewritten?: string, error?: string }>}
 */
export async function rewriteSlopSection({ passage, flags, model = 'claude-haiku-4-5-20251001' }) {
  if (!passage || typeof passage !== 'string') {
    return { ok: false, error: 'passage manquant' };
  }
  if (!Array.isArray(flags) || flags.length === 0) {
    return { ok: false, error: 'aucun flag fourni' };
  }

  // Liste lisible des raisons (dédupliquée)
  const reasons = Array.from(new Set(flags.map((f) => f.reason || f.category))).join(' / ');

  const system = `Tu es une assistante d'édition pour une praticienne en nutrition.
Tu reformules des passages courts de plans nutritionnels qui ont été détectés comme "AI-flavored" (trop génériques, trop symétriques, vocabulaire stéréotypé).

Règles :
- Garde le SENS exact et toute info clinique présente
- Voix première personne (la praticienne s'adresse à la cliente en tutoyant)
- Pas de métaphores clichés, pas de "rule of three" forcé
- Pas de mots type : protocole de base, timing adapté, axe prioritaire, indicateurs hebdomadaires, de manière optimale
- Préfère phrase directe et concrète. Si possible : ajoute un détail rendu humain.
- Ne PAS ajouter de markdown ou de mise en forme nouvelle
- Renvoie UNIQUEMENT le passage reformulé, rien d'autre

${VOICE_REFERENCE}`;

  const user = `Ce passage a été flagé pour : ${reasons}

Passage à reformuler :
"""
${passage}
"""

Reformule en gardant le sens exact mais avec la voix de référence. Renvoie uniquement le texte reformulé.`;

  try {
    const res = await callClaude({
      system,
      user,
      model,
      maxTokens: 800,
      skipVocabularyGuard: false, // on garde le guard vocab compliance
    });
    const rewritten = typeof res === 'string' ? res : res?.text || '';
    if (!rewritten || rewritten.trim().length === 0) {
      return { ok: false, error: 'reformulation vide' };
    }
    // Nettoyage : enlève guillemets éventuels ajoutés par le LLM.
    // V97.26 (audit test gap fix) — Triple quotes AVANT single quotes,
    // sinon le single quote strip casse le triple match.
    const cleaned = rewritten
      .trim()
      .replace(/^"""[\s\n]*/, '')
      .replace(/[\s\n]*"""$/, '')
      .replace(/^["«»]/, '')
      .replace(/["«»]$/, '')
      .trim();
    return { ok: true, rewritten: cleaned };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Remplace une ligne dans un planText par sa version reformulée.
 *
 * @param {string} planText
 * @param {number} lineIndex - 0-based
 * @param {string} newLine
 * @returns {string} Plan modifié
 */
export function replaceLineInPlan(planText, lineIndex, newLine) {
  if (!planText || typeof planText !== 'string') return planText;
  const lines = planText.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return planText;
  lines[lineIndex] = newLine;
  return lines.join('\n');
}
