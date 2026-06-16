// ─── journeyResolver.js ─────────────────────────────────────────────────
// V97.36 — Journey Resolver V1 (SaaS-only, lecture seule, pure function).
//
// POURQUOI CE MODULE EXISTE
//   Le parcours d'une cliente vit aujourd'hui dans TROIS machines à états
//   réparties sur DEUX bases :
//     1. SaaS  clients.journey_state  (8 étapes fines, cockpit Anissa)
//     2. App   clients.journey_status (7 états, timeline /parcours cliente)
//     3. App   client_plans + lib/plan-visibility (vérité contenu /plan)
//   La synchro 1→2 est best-effort, lossy, sans retry. Le lien 2→3 est un
//   seul await non transactionnel. Résultat : les trois peuvent diverger,
//   et personne ne sait répondre de façon fiable à « quelle est la
//   prochaine action ? ».
//
//   Ce module NE REMPLACE RIEN. Il ne migre rien, n'écrit rien, ne touche
//   ni journey_status ni la timeline cliente. Il se contente de RÉCONCILIER
//   les faits déjà chargés dans le dashboard (form + journey_state côté
//   SaaS, statusEntry côté app via clients-status) pour produire UNE
//   réponse dérivée : la prochaine action fiable pour Anissa.
//
//   C'est la généralisation du pattern plan-visibility (une source, des
//   lecteurs) appliquée au parcours complet — mais en V1, lecture seule.
//
// PÉRIMÈTRE V1 (strict)
//   - SaaS-only, pure (aucun import supabase / réseau / async).
//   - Additif : aucun comportement existant modifié.
//   - Répond UNIQUEMENT à « prochaine action Anissa ? ».
//   - Pas de prochaine action cliente, pas de fin de programme, pas
//     d'écriture, pas d'endpoint, pas de migration.

// Dupliqué volontairement depuis journeyState.js:164. On NE l'importe PAS
// pour garder ce module pur (journeyState.js importe supabase). À garder
// SYNCHRO avec journeyState.js si la liste y change.
const POST_ANAMNESIS_STEPS = [
  "analyses",
  "waiting_results",
  "results",
  "plan_generation",
  "plan_editing",
  "delivery",
  "followup",
];

/** Clés de prochaine action Anissa (table de décision V1). */
export const NEXT_ACTIONS = {
  none: { key: "none", label: "Cliente supprimée" },
  await_questionnaire: { key: "await_questionnaire", label: "En attente du questionnaire" },
  schedule_rdv: { key: "schedule_rdv", label: "Planifier le RDV anamnèse" },
  conduct_rdv: { key: "conduct_rdv", label: "Réaliser / valider le RDV anamnèse" },
  prepare_plan: { key: "prepare_plan", label: "Préparer / publier le plan" },
  followup: { key: "followup", label: "Suivi en cours" },
  unknown: { key: "unknown", label: "Statut à vérifier" },
};

/** Codes de divergence détectables en V1 (SaaS vs app). */
export const DIVERGENCE_CODES = {
  program_active_without_plan: "program_active_without_plan",
  plan_visible_not_active: "plan_visible_not_active",
  questionnaire_local_vs_app: "questionnaire_local_vs_app",
  rdv_local_vs_app: "rdv_local_vs_app",
  app_account_not_found: "app_account_not_found",
};

/**
 * @typedef {Object} JourneyFacts
 * @property {boolean} form_has_answers        SaaS : le pré-questionnaire (clients.form) a des réponses.
 * @property {string|null} questionnaire_completed_at  App : timestamp de complétion (statusEntry.journey).
 * @property {string|null} rdv_anamnesis_at    SaaS : RDV anamnèse planifié (journey_state.rdv_anamnesis_at).
 * @property {boolean} anamnesis_validated     SaaS : anamnèse validée (dérivation robuste, cf. extract).
 * @property {string|null} rdv_scheduled_at    App : RDV planifié côté app (statusEntry.journey).
 * @property {boolean} plan_visible            App : une publication réelle existe (plan-visibility).
 * @property {boolean} visible_now             App : la cliente voit un plan maintenant.
 * @property {string|null} plan_reason         App : reason_if_not_visible (plan-visibility).
 * @property {string|null} app_journey_status  App : journey_status — LU SEULEMENT pour les divergences.
 * @property {boolean} status_found            App : la cliente a bien un compte app (statusEntry.found).
 * @property {boolean} account_deleted         App : compte soft-deleted.
 */

/**
 * @typedef {Object} JourneyResolution
 * @property {boolean} questionnaire_received
 * @property {boolean} rdv_scheduled
 * @property {boolean} plan_visible
 * @property {{key:string,label:string,reason:string}} next_action_anissa
 * @property {Array<{code:string,severity:'high'|'medium'|'low',detail:string}>} divergences
 * @property {'high'|'medium'|'low'} confidence
 * @property {string[]} sources
 */

/** Defaults fail-closed : en l'absence de fait, on ne suppose RIEN de positif. */
const DEFAULT_FACTS = {
  form_has_answers: false,
  questionnaire_completed_at: null,
  rdv_anamnesis_at: null,
  anamnesis_validated: false,
  rdv_scheduled_at: null,
  plan_visible: false,
  visible_now: false,
  plan_reason: null,
  app_journey_status: null,
  status_found: false,
  account_deleted: false,
};

/**
 * Réconcilie les faits en une résolution dérivée. Pure : pas d'I/O, pas
 * d'async, pas d'horloge (les faits temporels sont déjà résolus en amont
 * par plan-visibility / clients-status).
 *
 * @param {Partial<JourneyFacts>} input
 * @returns {JourneyResolution}
 */
export function resolveJourney(input) {
  const f = { ...DEFAULT_FACTS, ...(input || {}) };

  // 1. Faits dérivés (cross-source, fail-closed).
  const questionnaire_received =
    f.form_has_answers === true || f.questionnaire_completed_at != null;
  const rdv_scheduled = !!f.rdv_anamnesis_at || !!f.rdv_scheduled_at;
  const plan_visible = f.plan_visible === true;

  // 2. Divergences (avant la table : elles influencent la confidence).
  const divergences = computeDivergences(f, { questionnaire_received, rdv_scheduled, plan_visible });

  // 3. Table de décision next_action_anissa (ordre strict).
  const next_action_anissa = decideNextAction(f, {
    questionnaire_received,
    rdv_scheduled,
    plan_visible,
  });

  // 4. Confidence.
  const confidence = computeConfidence(f, next_action_anissa, divergences);

  // 5. Provenance des faits exploités.
  const sources = computeSources(f);

  return {
    questionnaire_received,
    rdv_scheduled,
    plan_visible,
    next_action_anissa,
    divergences,
    confidence,
    sources,
  };
}

/**
 * Table de décision V1 corrigée (RDV planifié ≠ RDV réalisé).
 *
 * Ordre des barreaux = celui de la spec validée (0→6, premier match gagne).
 * MAIS chaque barreau « amont » est gardé contre les états « aval » déjà
 * atteints : un fait plus avancé (plan visible, anamnèse validée) ne doit
 * jamais être masqué par l'absence d'un signal antérieur. Sans ces gardes,
 * une cliente legacy dont le plan est déjà visible mais sans RDV horodaté
 * tomberait à tort sur « Planifier le RDV ». Net effet : « le progrès le
 * plus avancé gagne », tout en gardant la lisibilité de la table numérotée.
 */
function decideNextAction(f, d) {
  const anamnesisDone = f.anamnesis_validated === true;

  // 0. Compte supprimé : plus rien à faire (override absolu).
  if (f.account_deleted === true) {
    return { ...NEXT_ACTIONS.none, reason: "account_deleted" };
  }
  // 1. Pas de questionnaire reçu.
  if (!d.questionnaire_received) {
    return { ...NEXT_ACTIONS.await_questionnaire, reason: "no_questionnaire" };
  }
  // 2. Questionnaire reçu, aucun RDV planifié, et rien d'aval atteint.
  if (d.questionnaire_received && !d.rdv_scheduled && !anamnesisDone && !d.plan_visible) {
    return { ...NEXT_ACTIONS.schedule_rdv, reason: "questionnaire_received_no_rdv" };
  }
  // 3. RDV planifié mais anamnèse pas encore validée → RDV à réaliser.
  //    On ne considère JAMAIS un RDV planifié comme réalisé.
  if (d.rdv_scheduled && !anamnesisDone && !d.plan_visible) {
    return { ...NEXT_ACTIONS.conduct_rdv, reason: "rdv_scheduled_not_validated" };
  }
  // 4. Anamnèse validée mais pas de plan visible → préparer/publier le plan.
  if (anamnesisDone && !d.plan_visible) {
    return { ...NEXT_ACTIONS.prepare_plan, reason: "anamnesis_done_no_plan" };
  }
  // 5. Plan visible → suivi.
  if (d.plan_visible) {
    return { ...NEXT_ACTIONS.followup, reason: "plan_visible" };
  }
  // 6. Aucun signal exploitable.
  return { ...NEXT_ACTIONS.unknown, reason: "no_signal" };
}

/**
 * Divergences SaaS ↔ app. Les comparaisons questionnaire/RDV sont GATÉES sur
 * status_found===true : sans compte app, l'absence de timestamp app n'est pas
 * une contradiction mais une simple absence (évite les faux positifs).
 */
function computeDivergences(f, d) {
  const out = [];

  // program_active côté app mais aucun plan réellement publié (haute gravité :
  // la cliente peut voir « programme actif » sans contenu).
  if (f.app_journey_status === "program_active" && !d.plan_visible) {
    out.push({
      code: DIVERGENCE_CODES.program_active_without_plan,
      severity: "high",
      detail: "App: journey_status=program_active mais aucun plan visible.",
    });
  }

  // Plan publié mais la timeline app n'est pas passée à program_active.
  if (d.plan_visible && f.app_journey_status && f.app_journey_status !== "program_active") {
    out.push({
      code: DIVERGENCE_CODES.plan_visible_not_active,
      severity: "medium",
      detail: `App: plan visible mais journey_status=${f.app_journey_status}.`,
    });
  }

  // Questionnaire : SaaS (form) vs app (timestamp). Gaté sur compte app présent.
  if (f.status_found === true) {
    const appQuestionnaire = f.questionnaire_completed_at != null;
    if (f.form_has_answers !== appQuestionnaire) {
      out.push({
        code: DIVERGENCE_CODES.questionnaire_local_vs_app,
        severity: "medium",
        detail: `Questionnaire SaaS=${f.form_has_answers} vs app=${appQuestionnaire}.`,
      });
    }

    // RDV : SaaS (journey_state) vs app (journey).
    const saasRdv = !!f.rdv_anamnesis_at;
    const appRdv = !!f.rdv_scheduled_at;
    if (saasRdv !== appRdv) {
      out.push({
        code: DIVERGENCE_CODES.rdv_local_vs_app,
        severity: "medium",
        detail: `RDV SaaS=${saasRdv} vs app=${appRdv}.`,
      });
    }
  }

  // SaaS a de la matière (questionnaire / anamnèse) mais aucun compte app trouvé.
  if (f.status_found !== true && (f.form_has_answers === true || f.anamnesis_validated === true)) {
    out.push({
      code: DIVERGENCE_CODES.app_account_not_found,
      severity: "low",
      detail: "SaaS a des faits parcours mais aucun compte app correspondant.",
    });
  }

  return out;
}

/**
 * Confidence V1 :
 *   - high   : faits concordants OU fait SaaS fiable sans contradiction.
 *   - medium : un seul côté disponible (pas de compte app trouvé).
 *   - low    : contradiction (divergence high/medium) ou aucun signal (unknown).
 */
function computeConfidence(f, nextAction, divergences) {
  if (nextAction.key === "none") return "high"; // compte supprimé : fait net.
  if (nextAction.key === "unknown") return "low"; // aucun signal exploitable.
  const hasBlocking = divergences.some((d) => d.severity === "high" || d.severity === "medium");
  if (hasBlocking) return "low";
  if (f.status_found !== true) return "medium"; // un seul côté (SaaS) disponible.
  return "high";
}

/** Provenance des faits réellement exploités (traçabilité, pas décision). */
function computeSources(f) {
  const sources = [];
  if (f.form_has_answers === true) sources.push("saas:form");
  if (f.rdv_anamnesis_at != null || f.anamnesis_validated === true) sources.push("saas:journey_state");
  if (f.status_found === true) sources.push("app:clients-status");
  return sources;
}

/**
 * Adapter SaaS : transforme un { client, statusEntry } du dashboard en
 * JourneyFacts. C'est ICI (et seulement ici) qu'on connaît les formes réelles
 * des objets ; resolveJourney reste agnostique.
 *
 *   client     : ligne SaaS { form, journey_state, ... } (peut être partiel).
 *   statusEntry : entrée renvoyée par fetchClientsStatus (clients-status), ou
 *                 null/undefined si la cliente n'a pas de compte app connu.
 *
 * @param {{ client?: any, statusEntry?: any }} param0
 * @returns {JourneyFacts}
 */
export function extractJourneyFacts({ client, statusEntry } = {}) {
  const form = client?.form || {};
  const js = client?.journey_state || {};
  const entry = statusEntry || null;
  const journey = entry?.journey || null;

  // Heuristique questionnaire SaaS : identique à AnissaDashboard.jsx (preQReceived).
  const form_has_answers = !!(
    form.objectif_primaire ||
    form.dureeProbleme ||
    form.ressentiDigestion
  );

  // Dérivation robuste de l'anamnèse validée — cf. journeyState.js:169.
  // Les clientes legacy n'ont pas anamnesis_validated explicite mais sont déjà
  // dans un step post-anamnèse : on les considère implicitement validées.
  const anamnesis_validated =
    js.anamnesis_validated === true ||
    POST_ANAMNESIS_STEPS.includes(js.current_step);

  return {
    form_has_answers,
    questionnaire_completed_at: journey?.questionnaire_completed_at ?? null,
    rdv_anamnesis_at: js.rdv_anamnesis_at ?? null,
    anamnesis_validated,
    rdv_scheduled_at: journey?.rdv_scheduled_at ?? null,
    plan_visible: entry?.plan_visible === true,
    visible_now: entry?.visible_now === true,
    plan_reason: entry?.reason_if_not_visible ?? null,
    app_journey_status: journey?.status ?? null,
    status_found: entry?.found === true,
    account_deleted: entry?.account_deleted === true,
  };
}
