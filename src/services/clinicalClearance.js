// ─── clinicalClearance.js ───────────────────────────────────────────────
// P1.2 (remède sécurité clinique, 2026-06-10) — clairance clinique unique.
//
// Un plan généré sort par QUATRE portes (Adopter, export Word, export Fiche
// frigo, publication app cliente). Avant remède, le gate (cosmétique) vivait
// sur un seul bouton → trois backdoors le contournaient. Ici le gate vit dans
// UNE fonction pure consultée par les quatre portes.
//
// Sévérité INTRINSÈQUE au type de match (pas de colonne `severity` en DB — la
// gravité n'est pas un attribut de ligne guardrail, c'est la nature du match
// qui la porte) :
//   HIGH (bloquant, override conscient aux portes manuelles) :
//     - allergène déclaré (form.allergies) présent dans le plan
//     - phrase interdite guardrail présente dans le plan
//     - interaction classée 'blocking' présente dans le plan
//   LOW (warning non bloquant) :
//     - intolérance (form.alimentsEvites) présente
//     - interaction classée 'needs_review' présente (à valider Anissa)
//
// FAIL-CLOSED : input illisible ou audit qui throw = clairance refusée
// (cleared:false, severity:'high'). Jamais de feu vert par défaut. C'est le
// réflexe inverse du dev par défaut — il est explicite ici.
//
// La classification bloquant/advisory/needs_review est une DONNÉE révisable
// par Anissa (clinicalInteractions.js), pas une décision codée par un
// non-clinicien.

import { analyzeAnamnese } from './anamneseAnalyzer';
import { detectClientProfile } from './prompts/nutrition/profiles/_detector.fr';
import {
  detectClinicalGuardrails,
  auditPlanForGuardrails,
} from './prompts/nutrition/_clinicalGuardrails.fr';
import { classifyInteraction, normalizeForMatch } from './clinicalInteractions';

/**
 * @typedef {object} ClearanceVerdict
 * @property {boolean} cleared - false si une violation HIGH (ou fail-closed).
 * @property {'none'|'high'} severity - gravité maximale rencontrée.
 * @property {Array<{type:string, severity:'high', label:string, snippet?:string}>} violations
 * @property {Array<{type:string, severity:'low', label:string}>} warnings
 */

const FAIL_CLOSED = Object.freeze({
  cleared: false,
  severity: 'high',
  violations: [{ type: 'clearance_error', severity: 'high', label: 'Clairance impossible (entrée illisible ou audit en échec) — bloqué par sécurité.' }],
  warnings: [],
});

/** Découpe un champ libre (allergies/intolérances) en tokens significatifs. */
function tokenize(field) {
  return String(field ?? '')
    .split(/[,;/\n]| et /i)
    .map((t) => normalizeForMatch(t))
    .filter((t) => t.length >= 3);
}

/**
 * Clairance clinique d'un plan généré. Fonction pure, fail-closed.
 *
 * @param {string} planText - Le plan nutrition généré.
 * @param {{ form?: object, guardrails?: Array }} [clinicalContext]
 * @returns {ClearanceVerdict}
 */
export function assertPlanClinicallyCleared(planText, clinicalContext = {}) {
  // FAIL-CLOSED : pas de plan lisible = pas de clairance possible.
  if (typeof planText !== 'string' || planText.trim() === '') {
    return { ...FAIL_CLOSED, violations: [...FAIL_CLOSED.violations] };
  }

  try {
    const form = clinicalContext.form || {};
    const normPlan = normalizeForMatch(planText);
    const violations = [];
    const warnings = [];

    // 1. Allergènes déclarés présents dans le plan → HIGH.
    for (const tok of tokenize(form.allergies)) {
      if (normPlan.includes(tok)) {
        violations.push({ type: 'allergen', severity: 'high', label: `Allergène déclaré présent dans le plan : « ${tok} ».` });
      }
    }

    // 2. Intolérances présentes → warning non bloquant.
    for (const tok of tokenize(form.alimentsEvites)) {
      if (normPlan.includes(tok)) {
        warnings.push({ type: 'intolerance', severity: 'low', label: `Intolérance déclarée mentionnée dans le plan : « ${tok} » (à vérifier).` });
      }
    }

    // 3. Phrases interdites guardrail présentes → HIGH.
    const guardrails = Array.isArray(clinicalContext.guardrails)
      ? clinicalContext.guardrails
      : detectClinicalGuardrails(detectClientProfile(form), form);
    const grViolations = auditPlanForGuardrails(planText, guardrails);
    for (const gv of grViolations) {
      violations.push({ type: 'guardrail', severity: 'high', label: `Formulation interdite (${gv.profile_key}) : « ${gv.phrase} ».`, snippet: gv.snippet });
    }

    // 4. Interactions complément↔traitement présentes dans le plan.
    //    'blocking' → HIGH ; 'needs_review' → warning ; 'advisory' → ignoré.
    const treatments = analyzeAnamnese(form).traitements || {};
    for (const t of Object.values(treatments)) {
      if (!t || !t.active || !Array.isArray(t.interactions)) continue;
      for (const raw of t.interactions) {
        const cls = classifyInteraction(raw);
        if (cls === 'advisory') continue;
        const keyword = normalizeForMatch(String(raw).split('(')[0]);
        if (keyword.length < 3 || !normPlan.includes(keyword)) continue;
        if (cls === 'blocking') {
          violations.push({ type: 'interaction', severity: 'high', label: `Substance contre-indiquée avec un traitement en cours : « ${keyword} ».` });
        } else {
          warnings.push({ type: 'interaction_review', severity: 'low', label: `Substance à valider cliniquement (interaction possible) : « ${keyword} ».` });
        }
      }
    }

    const cleared = violations.length === 0;
    return {
      cleared,
      severity: cleared ? 'none' : 'high',
      violations,
      warnings,
    };
  } catch {
    // FAIL-CLOSED : tout audit qui throw = bloqué, jamais feu vert.
    return { ...FAIL_CLOSED, violations: [...FAIL_CLOSED.violations] };
  }
}

// P1.2 (colmatage backdoors, 2026-06-10) — erreur jetée par la garde d'export.
// Même rôle que PublishClinicalError côté publication : porte le verdict pour
// que l'UI puisse présenter un override conscient. Le gate vit dans le SERVICE
// d'export (assertExportCleared), pas sur les boutons — sinon chaque nouveau
// bouton qui appelle exportPlanToWord/exportFicheFrigoPDF rouvre une backdoor.
export class ExportClinicalError extends Error {
  constructor(verdict) {
    super('Clairance clinique refusée — export bloqué.');
    this.name = 'ExportClinicalError';
    this.verdict = verdict;
  }
}

/**
 * P1.2 — Garde de clairance pour les services d'export (Word, Fiche frigo PDF).
 * À appeler en TÊTE de chaque fonction d'export pour que tous les call sites
 * soient couverts par une seule barrière. Throw ExportClinicalError si le plan
 * n'est pas clairé, sauf override conscient explicite (options.clinicalOverride
 * positionné par l'UI après un window.confirm).
 *
 * Renvoie TOUJOURS le verdict (même en override) pour traçabilité.
 *
 * @param {string} planText
 * @param {{ form?: object, guardrails?: Array }} [clinicalContext]
 * @param {{ clinicalOverride?: boolean }} [options]
 * @returns {ClearanceVerdict}
 */
export function assertExportCleared(planText, clinicalContext = {}, options = {}) {
  const verdict = assertPlanClinicallyCleared(planText, clinicalContext);
  if (!verdict.cleared && !options.clinicalOverride) {
    throw new ExportClinicalError(verdict);
  }
  return verdict;
}

/**
 * Formate un verdict pour un override conscient (window.confirm aux portes
 * manuelles). Pure — testable. Renvoie le message à présenter à Anissa.
 *
 * @param {ClearanceVerdict} verdict
 * @returns {string}
 */
export function formatClearanceForConfirm(verdict) {
  const v = verdict || {};
  const lines = ['Clairance clinique — ce plan présente un risque de sécurité :', ''];
  for (const x of v.violations || []) lines.push(`• ${x.label}`);
  if (Array.isArray(v.warnings) && v.warnings.length > 0) {
    lines.push('', 'À vérifier (non bloquant) :');
    for (const w of v.warnings) lines.push(`• ${w.label}`);
  }
  lines.push('', 'Sortir ce plan malgré cet avertissement ? (override conscient)');
  return lines.join('\n');
}

/**
 * P1.3 — Traduit un verdict (frais OU relu depuis trigger_metadata, parfois
 * absent sur d'anciens brouillons pré-P1.3) en descripteur d'affichage pour le
 * panel de validation. Le badge est INFORMATIF : le gate dur reste la
 * re-vérification live à la publication (assertPlanClinicallyCleared dans
 * publishConsultationToClientApp).
 *
 * @param {ClearanceVerdict|null|undefined} verdict
 * @returns {{ tone: 'block'|'warn'|'ok'|'unknown', label: string, blocking: boolean }}
 */
export function clearanceBadge(verdict) {
  if (!verdict || typeof verdict !== 'object') {
    return { tone: 'unknown', label: 'Clairance non évaluée', blocking: false };
  }
  const violations = Array.isArray(verdict.violations) ? verdict.violations : [];
  const warnings = Array.isArray(verdict.warnings) ? verdict.warnings : [];
  if (verdict.cleared === false || verdict.severity === 'high' || violations.length > 0) {
    const n = violations.length;
    return {
      tone: 'block',
      label: n > 0
        ? `Clairance refusée — ${n} alerte${n > 1 ? 's' : ''} bloquante${n > 1 ? 's' : ''}`
        : 'Clairance refusée',
      blocking: true,
    };
  }
  if (warnings.length > 0) {
    const n = warnings.length;
    return { tone: 'warn', label: `À vérifier — ${n} avertissement${n > 1 ? 's' : ''}`, blocking: false };
  }
  return { tone: 'ok', label: 'Clairance clinique OK', blocking: false };
}
