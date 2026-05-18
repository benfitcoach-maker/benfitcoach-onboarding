// V96.11 — French composer (Phase 3.B). Assembles a system prompt by
// composing :
//   1. The base SYSTEM_PROMPT_FR (identity + clinical rules + style)
//   2. The Swiss brands context
//   3. Optional supplements rules (if the client is open to them)
//   4. Profile-specific modules detected from the form (femmeCycle,
//      perimenopause, menopause, diabete, digestifChronique)
//   5. The plan-mode prompt (oneshot, fourWeeks, or followup)
//
// Compared to buildSystemPromptFr in ./fr.js, the composer adds STEP 4
// (profile injection) and is otherwise behavior-equivalent.
//
// IMPORTANT — opt-in path :
//   This composer is NOT wired into NutritionConsultation.jsx by default.
//   It must be called explicitly via buildSystemPromptFrV2 (also exported
//   from ./fr.js) with the option { useComposer: true }. Until Anissa has
//   reviewed the profile modules, the legacy path remains active.

import {
  SYSTEM_PROMPT_FR,
  SWISS_BRANDS_PROMPT_FR,
  SUPPLEMENT_PROMPT_FR,
  ONESHOT_PLAN_PROMPT_FR,
  FOUR_WEEKS_PROMPT_FR,
  buildFollowupPromptFr,
} from './fr';
import { detectClientProfile } from './profiles/_detector.fr';
import { getProfileModuleFr } from './profiles/index.fr';
// V97.4 (Phase V1) : couche clinicalContext — tests / markers / signals /
// microbiomeStage / modules / safety rules. Voir ./_clinicalContext.fr.js.
import { buildClinicalContextBlockFr } from './_clinicalContext.fr';
// V97.4 V3.H Gap #3 : objectifs priorisés pour focaliser le plan IA.
import { formatPrioritizedObjectivesFr } from './_objectives.fr';
// V97.x Phase 1 (urgent risque légal) : couche garde-fous cliniques.
// Phrases interdites + vocab précaution injectés en TÊTE du prompt pour
// que le LLM les voie en premier (priorité maximale).
import { detectClinicalGuardrails, buildGuardrailsBlockFr } from './_clinicalGuardrails.fr';

/**
 * Build the FR system prompt with profile-aware composition.
 *
 * V97.4 (Phase V1) : ajout d'un 3e paramètre optionnel `clinicalContext`
 * pour injecter le bloc clinique structuré (tests / markers / résultats /
 * signaux / microbiomeStage) entre les profileModules et le planMode.
 * Si `clinicalContext` est null ou vide, le comportement reste identique
 * à la version V96.11 (rétro-compatibilité garantie).
 *
 * @param {object} form - The client anamnese (clients.form in storage)
 * @param {object} opts - Plan options
 * @param {boolean} [opts.isFollowup]   - true for weekly follow-up
 * @param {string}  [opts.clientFormule] - 'suivi' | 'intensif' | 'autonome' | 'nutrition' | 'custom'
 * @param {number}  [opts.followupWeek] - 1..4 when isFollowup
 * @param {string}  [opts.planMode]     - 'oneshot' | 'followup'
 * @param {object | null} [clinicalContext] - V97.4 : tests / markers /
 *   enteredResults / clinicalSignals / microbiomeStage / promptModules /
 *   safetyRules. Voir _clinicalContext.fr.js pour le shape complet.
 * @returns {{ prompt: string, profile: object, blocked: boolean }}
 *   - prompt   : the assembled system prompt (or empty string if blocked)
 *   - profile  : the detected client profile (for logging / UI feedback)
 *   - blocked  : true if a primary profile blocks generation (eg pregnancy
 *                without a dedicated module). Caller must surface this to
 *                the user and skip the AI call.
 */
export function composeSystemPromptFr(form, opts = {}, clinicalContext = null) {
  const profile = detectClientProfile(form);

  // Safety gate — block generation when we lack a safe module.
  if (profile.blocked) {
    return { prompt: '', profile, blocked: true };
  }

  const { isFollowup = false, clientFormule = '', followupWeek = 0, planMode = 'followup' } = opts;
  const parts = [SYSTEM_PROMPT_FR, SWISS_BRANDS_PROMPT_FR];

  // V97.x Phase 1 — Garde-fous cliniques (urgent risque légal).
  // Injectés IMMÉDIATEMENT après l'identité pour priorité LLM maximale.
  // Détecte profil → liste phrases interdites + vocab précaution.
  // Cf _clinicalGuardrails.fr.js + spec composer-v97-clinical-antislop.
  const guardrails = detectClinicalGuardrails(profile, form);
  const guardrailsBlock = buildGuardrailsBlockFr(guardrails);
  if (guardrailsBlock) {
    parts.push(guardrailsBlock);
  }

  // Supplements gate (unchanged from legacy path).
  const pretProtocole = form?.pretProtocole || '';
  if (pretProtocole === 'Oui' || pretProtocole === 'Peut-etre') {
    parts.push(SUPPLEMENT_PROMPT_FR);
  }

  // Inject profile modules (primary first, then pathologies). V96.17 : cap
  // monte de 5 a 6, V96.26 : cap monte de 6 a 8 pour absorber les profils
  // ultra-comorbides apres ajout des 8 nouveaux modules (performanceSportif,
  // thyroide, burnoutCortisol, preConceptionFertilite, spm, endometriose, tdah,
  // sopk). Coût token marginal au regard du benefice clinique.
  const profileModules = profile.all
    .slice(0, 8)
    .map(getProfileModuleFr)
    .filter(Boolean);
  if (profileModules.length > 0) {
    parts.push('// ═══ MODULES PROFIL CLIENT ═══');
    parts.push(...profileModules);
  }

  // V97.4 (Phase V1) : injection du contexte clinique structuré APRÈS les
  // profileModules et AVANT le planMode. Si clinicalContext est null ou
  // vide, buildClinicalContextBlockFr retourne '' et rien n'est injecté.
  const clinicalBlock = buildClinicalContextBlockFr(clinicalContext);
  if (clinicalBlock) {
    parts.push('// ═══ CONTEXTE CLINIQUE STRUCTURÉ ═══');
    parts.push(clinicalBlock);
  }

  // V97.4 V3.H Gap #3 : objectifs priorisés (focus plan IA).
  // Injecté APRÈS le contexte clinique → l'IA voit d'abord la situation
  // bio, puis ce qu'on veut prioriser. Retourne '' si rien rempli.
  const objectivesBlock = formatPrioritizedObjectivesFr(form);
  if (objectivesBlock) {
    parts.push('// ═══ OBJECTIFS PRIORISÉS ═══');
    parts.push(objectivesBlock);
  }

  // Plan mode (unchanged from legacy path).
  if (isFollowup && followupWeek > 0) {
    parts.push(buildFollowupPromptFr(followupWeek));
  } else if (planMode === 'oneshot') {
    parts.push(ONESHOT_PLAN_PROMPT_FR);
  } else {
    const recurrentFormules = ['suivi', 'intensif', 'autonome', 'nutrition', 'custom'];
    const normalizedFormule = (clientFormule || '').trim().toLowerCase();
    if (recurrentFormules.includes(normalizedFormule)) {
      parts.push(FOUR_WEEKS_PROMPT_FR);
    }
  }

  return {
    prompt: parts.join('\n\n'),
    profile,
    blocked: false,
    // V97.x Phase 1 — Garde-fous exposés au caller pour audit post-génération.
    // Le caller (NutritionConsultation / JourneyPlanEditor) peut appeler
    // auditPlanForGuardrails(plan, guardrails) après réception du draft IA
    // pour vérifier qu'aucune phrase interdite n'est passée.
    guardrails,
  };
}
