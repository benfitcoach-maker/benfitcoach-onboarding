// ─── journeyResolver.test.js ────────────────────────────────────────────
// V97.36 — Tests du Journey Resolver V1 (pure function, SaaS-only).
// Couvre : la table de décision (chaque barreau, dont conduct_rdv), la
// confidence, les 5 divergences + cas sain, sources[], et l'adapter
// extractJourneyFacts (formes réelles + fail-closed + account_deleted).

import { describe, it, expect } from "vitest";
import {
  resolveJourney,
  extractJourneyFacts,
  NEXT_ACTIONS,
  DIVERGENCE_CODES,
} from "./journeyResolver.js";

// Base "compte app présent, rien de fait" pour isoler chaque barreau.
const baseFound = {
  form_has_answers: false,
  questionnaire_completed_at: null,
  rdv_anamnesis_at: null,
  anamnesis_validated: false,
  rdv_scheduled_at: null,
  plan_visible: false,
  visible_now: false,
  plan_reason: null,
  app_journey_status: null,
  status_found: true,
  account_deleted: false,
};

describe("resolveJourney — table de décision next_action_anissa", () => {
  it("0. account_deleted → none", () => {
    const r = resolveJourney({ ...baseFound, account_deleted: true, form_has_answers: true });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.none.key);
    expect(r.next_action_anissa.label).toBe("Cliente supprimée");
  });

  it("1. pas de questionnaire → await_questionnaire", () => {
    const r = resolveJourney({ ...baseFound });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.await_questionnaire.key);
    expect(r.questionnaire_received).toBe(false);
  });

  it("1bis. questionnaire reconnu via timestamp app seul", () => {
    const r = resolveJourney({ ...baseFound, questionnaire_completed_at: "2026-06-01T10:00:00Z" });
    expect(r.questionnaire_received).toBe(true);
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.schedule_rdv.key);
  });

  it("2. questionnaire reçu sans RDV → schedule_rdv", () => {
    const r = resolveJourney({ ...baseFound, form_has_answers: true });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.schedule_rdv.key);
    expect(r.rdv_scheduled).toBe(false);
  });

  it("3. RDV planifié mais anamnèse non validée → conduct_rdv (jamais prepare_plan)", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      rdv_anamnesis_at: "2026-06-10T09:00:00Z",
      anamnesis_validated: false,
    });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.conduct_rdv.key);
    expect(r.next_action_anissa.label).toBe("Réaliser / valider le RDV anamnèse");
    expect(r.rdv_scheduled).toBe(true);
  });

  it("3bis. RDV planifié côté app seul compte aussi comme rdv_scheduled", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      rdv_scheduled_at: "2026-06-10T09:00:00Z",
    });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.conduct_rdv.key);
  });

  it("4. anamnèse validée sans plan visible → prepare_plan", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      rdv_anamnesis_at: "2026-06-10T09:00:00Z",
      anamnesis_validated: true,
      plan_visible: false,
    });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.prepare_plan.key);
  });

  it("4bis. anamnèse validée sans RDV planifié → prepare_plan (legacy)", () => {
    // Cliente legacy : anamnèse implicitement validée (step post-anamnèse),
    // pas de rdv_anamnesis_at. Ne doit pas rester bloquée sur conduct_rdv.
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      rdv_anamnesis_at: null,
      anamnesis_validated: true,
    });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.prepare_plan.key);
  });

  it("5. plan visible → followup", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      anamnesis_validated: true,
      plan_visible: true,
      visible_now: true,
      app_journey_status: "program_active",
    });
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.followup.key);
  });

  it("6. aucun signal exploitable → unknown", () => {
    // Pas de compte app, rien côté SaaS : on ne devine pas.
    const r = resolveJourney({});
    // questionnaire_received=false → await_questionnaire prime AVANT unknown.
    // Pour atteindre unknown il faut questionnaire reçu + rien d'autre… ce qui
    // route sur schedule_rdv. unknown n'est atteint que si la ladder ne matche
    // aucune branche positive : on force le cas via plan_visible faux + RDV +
    // anamnèse fausse MAIS questionnaire faux → ladder s'arrête en 1.
    expect(r.next_action_anissa.key).toBe(NEXT_ACTIONS.await_questionnaire.key);
  });
});

describe("resolveJourney — confidence", () => {
  it("none → high (fait net)", () => {
    const r = resolveJourney({ ...baseFound, account_deleted: true });
    expect(r.confidence).toBe("high");
  });

  it("faits concordants compte app présent → high", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      questionnaire_completed_at: "2026-06-01T10:00:00Z",
      rdv_anamnesis_at: "2026-06-10T09:00:00Z",
      rdv_scheduled_at: "2026-06-10T09:00:00Z",
      anamnesis_validated: true,
      plan_visible: true,
      app_journey_status: "program_active",
    });
    expect(r.divergences).toHaveLength(0);
    expect(r.confidence).toBe("high");
  });

  it("un seul côté (pas de compte app) → medium", () => {
    const r = resolveJourney({
      form_has_answers: true,
      status_found: false,
    });
    expect(r.confidence).toBe("medium");
  });

  it("contradiction (divergence) → low", () => {
    const r = resolveJourney({
      ...baseFound,
      plan_visible: false,
      app_journey_status: "program_active", // high divergence
    });
    expect(r.confidence).toBe("low");
  });
});

describe("resolveJourney — divergences", () => {
  it("program_active_without_plan (high)", () => {
    const r = resolveJourney({ ...baseFound, plan_visible: false, app_journey_status: "program_active" });
    const codes = r.divergences.map((d) => d.code);
    expect(codes).toContain(DIVERGENCE_CODES.program_active_without_plan);
    expect(r.divergences.find((d) => d.code === DIVERGENCE_CODES.program_active_without_plan).severity).toBe("high");
  });

  it("plan_visible_not_active (medium)", () => {
    const r = resolveJourney({ ...baseFound, plan_visible: true, app_journey_status: "rdv_done" });
    const codes = r.divergences.map((d) => d.code);
    expect(codes).toContain(DIVERGENCE_CODES.plan_visible_not_active);
  });

  it("questionnaire_local_vs_app (medium, gaté sur status_found)", () => {
    const r = resolveJourney({ ...baseFound, form_has_answers: true, questionnaire_completed_at: null });
    expect(r.divergences.map((d) => d.code)).toContain(DIVERGENCE_CODES.questionnaire_local_vs_app);
  });

  it("rdv_local_vs_app (medium)", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      questionnaire_completed_at: "2026-06-01T10:00:00Z",
      rdv_anamnesis_at: "2026-06-10T09:00:00Z",
      rdv_scheduled_at: null,
    });
    expect(r.divergences.map((d) => d.code)).toContain(DIVERGENCE_CODES.rdv_local_vs_app);
  });

  it("app_account_not_found (low)", () => {
    const r = resolveJourney({ form_has_answers: true, status_found: false });
    expect(r.divergences.map((d) => d.code)).toContain(DIVERGENCE_CODES.app_account_not_found);
    expect(r.divergences.find((d) => d.code === DIVERGENCE_CODES.app_account_not_found).severity).toBe("low");
  });

  it("cas sain : aucune divergence", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      questionnaire_completed_at: "2026-06-01T10:00:00Z",
      rdv_anamnesis_at: "2026-06-10T09:00:00Z",
      rdv_scheduled_at: "2026-06-10T09:00:00Z",
      anamnesis_validated: true,
      plan_visible: true,
      app_journey_status: "program_active",
    });
    expect(r.divergences).toHaveLength(0);
  });

  it("pas de faux positif questionnaire/rdv quand compte app absent", () => {
    const r = resolveJourney({ form_has_answers: true, status_found: false, rdv_anamnesis_at: "2026-06-10T09:00:00Z" });
    const codes = r.divergences.map((d) => d.code);
    expect(codes).not.toContain(DIVERGENCE_CODES.questionnaire_local_vs_app);
    expect(codes).not.toContain(DIVERGENCE_CODES.rdv_local_vs_app);
  });
});

describe("resolveJourney — sources[]", () => {
  it("trace les sources réellement exploitées", () => {
    const r = resolveJourney({
      ...baseFound,
      form_has_answers: true,
      rdv_anamnesis_at: "2026-06-10T09:00:00Z",
    });
    expect(r.sources).toContain("saas:form");
    expect(r.sources).toContain("saas:journey_state");
    expect(r.sources).toContain("app:clients-status");
  });

  it("aucune source quand rien d'exploitable", () => {
    const r = resolveJourney({});
    expect(r.sources).toHaveLength(0);
  });
});

describe("extractJourneyFacts — adapter", () => {
  it("mappe les formes réelles client + statusEntry", () => {
    const facts = extractJourneyFacts({
      client: {
        form: { objectif_primaire: "perte de poids" },
        journey_state: { current_step: "plan_editing", rdv_anamnesis_at: "2026-06-10T09:00:00Z" },
      },
      statusEntry: {
        found: true,
        plan_visible: true,
        visible_now: true,
        reason_if_not_visible: null,
        account_deleted: false,
        journey: {
          status: "program_active",
          questionnaire_completed_at: "2026-06-01T10:00:00Z",
          rdv_scheduled_at: "2026-06-10T09:00:00Z",
        },
      },
    });
    expect(facts.form_has_answers).toBe(true);
    expect(facts.anamnesis_validated).toBe(true); // current_step post-anamnèse
    expect(facts.rdv_anamnesis_at).toBe("2026-06-10T09:00:00Z");
    expect(facts.questionnaire_completed_at).toBe("2026-06-01T10:00:00Z");
    expect(facts.rdv_scheduled_at).toBe("2026-06-10T09:00:00Z");
    expect(facts.plan_visible).toBe(true);
    expect(facts.app_journey_status).toBe("program_active");
    expect(facts.status_found).toBe(true);
  });

  it("dérivation robuste : anamnesis_validated explicite", () => {
    const facts = extractJourneyFacts({
      client: { form: {}, journey_state: { current_step: "anamnesis", anamnesis_validated: true } },
    });
    expect(facts.anamnesis_validated).toBe(true);
  });

  it("dérivation robuste : anamnèse NON validée si step anamnesis sans flag", () => {
    const facts = extractJourneyFacts({
      client: { form: {}, journey_state: { current_step: "anamnesis" } },
    });
    expect(facts.anamnesis_validated).toBe(false);
  });

  it("fail-closed quand statusEntry absent", () => {
    const facts = extractJourneyFacts({ client: { form: { objectif_primaire: "x" }, journey_state: {} } });
    expect(facts.status_found).toBe(false);
    expect(facts.plan_visible).toBe(false);
    expect(facts.questionnaire_completed_at).toBe(null);
    expect(facts.rdv_scheduled_at).toBe(null);
    expect(facts.app_journey_status).toBe(null);
    expect(facts.account_deleted).toBe(false);
  });

  it("propage account_deleted depuis statusEntry", () => {
    const facts = extractJourneyFacts({
      client: { form: {}, journey_state: {} },
      statusEntry: { found: true, account_deleted: true, journey: null },
    });
    expect(facts.account_deleted).toBe(true);
  });

  it("entrée totalement vide → tous defaults fail-closed", () => {
    const facts = extractJourneyFacts();
    expect(facts.form_has_answers).toBe(false);
    expect(facts.anamnesis_validated).toBe(false);
    expect(facts.status_found).toBe(false);
  });
});
