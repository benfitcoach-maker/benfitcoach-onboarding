import { describe, it, expect } from "vitest";
import {
  computeEditorialReadiness,
  EDITORIAL_SECTIONS,
  READINESS_META,
} from "./editorialReadiness";

// Plan complet (les 5 sections remplies) — sert de base aux variations.
function fullPlan() {
  return {
    sections: {
      intro_data: { body: ["Bonjour", "Voici votre programme."] },
      strategy_data: { pillars: [{ title: "Fibres" }] },
      week_meals: { days: [{ meals: [{ slot: "petit-dej" }] }] },
      fridge_data: { essentials: [{ label: "Épinards" }] },
      protocols_data: { groups: [{ name: "Matin" }] },
    },
  };
}

describe("computeEditorialReadiness — niveaux", () => {
  it("plan complet + config OK + email → ready", () => {
    const r = computeEditorialReadiness(fullPlan(), { cfgOk: true, hasEmail: true });
    expect(r.level).toBe("ready");
    expect(r.technical).toEqual([]);
    expect(r.emptyCount).toBe(0);
    expect(r.sections.every((s) => s.filled)).toBe(true);
  });

  it("une section vide → review (doux, jamais bloquant)", () => {
    const plan = fullPlan();
    plan.sections.intro_data = { body: [] };
    const r = computeEditorialReadiness(plan, { cfgOk: true, hasEmail: true });
    expect(r.level).toBe("review");
    expect(r.emptyCount).toBe(1);
    expect(r.technical).toEqual([]);
    expect(r.sections.find((s) => s.key === "intro").filled).toBe(false);
  });

  it("plusieurs sections vides → review", () => {
    const plan = fullPlan();
    plan.sections.intro_data = { body: [] };
    plan.sections.protocols_data = { groups: [] };
    const r = computeEditorialReadiness(plan, { cfgOk: true, hasEmail: true });
    expect(r.level).toBe("review");
    expect(r.emptyCount).toBe(2);
  });

  it("config manquante → blocked (même si tout est rempli)", () => {
    const r = computeEditorialReadiness(fullPlan(), { cfgOk: false, hasEmail: true });
    expect(r.level).toBe("blocked");
    expect(r.technical).toContain("Config publication manquante");
  });

  it("cliente sans email → blocked", () => {
    const r = computeEditorialReadiness(fullPlan(), { cfgOk: true, hasEmail: false });
    expect(r.level).toBe("blocked");
    expect(r.technical).toContain("Cliente sans email");
  });

  it("plan null (mapping erreur) → blocked + toutes sections non remplies", () => {
    const r = computeEditorialReadiness(null, { cfgOk: true, hasEmail: true });
    expect(r.level).toBe("blocked");
    expect(r.technical).toContain("Mapping en erreur");
    expect(r.sections.every((s) => !s.filled)).toBe(true);
  });

  it("blocages techniques cumulés", () => {
    const r = computeEditorialReadiness(null, { cfgOk: false, hasEmail: false });
    expect(r.level).toBe("blocked");
    expect(r.technical).toEqual([
      "Mapping en erreur",
      "Config publication manquante",
      "Cliente sans email",
    ]);
  });

  it("technique prime sur éditorial (blocked > review)", () => {
    const plan = fullPlan();
    plan.sections.intro_data = { body: [] }; // éditorial incomplet
    const r = computeEditorialReadiness(plan, { cfgOk: false, hasEmail: true });
    expect(r.level).toBe("blocked"); // pas review
  });
});

describe("computeEditorialReadiness — règles de vacuité par section", () => {
  it("intro vide si body absent ou vide", () => {
    const r = computeEditorialReadiness({ sections: { intro_data: {} } }, {});
    expect(r.sections.find((s) => s.key === "intro").filled).toBe(false);
  });

  it("strategy vide si pillars absent ou vide", () => {
    const r = computeEditorialReadiness({ sections: { strategy_data: { pillars: [] } } }, {});
    expect(r.sections.find((s) => s.key === "strategy").filled).toBe(false);
  });

  it("week_meals remplie dès 1 repas au jour 1", () => {
    const r = computeEditorialReadiness(
      { sections: { week_meals: { days: [{ meals: [{ slot: "midi" }] }] } } },
      {}
    );
    expect(r.sections.find((s) => s.key === "week_meals").filled).toBe(true);
  });

  it("fridge remplie via favorite seul (essentials vide)", () => {
    const r = computeEditorialReadiness(
      { sections: { fridge_data: { essentials: [], favorite: [{ label: "Avocat" }] } } },
      {}
    );
    expect(r.sections.find((s) => s.key === "fridge").filled).toBe(true);
  });

  it("supplements vide si groups absent", () => {
    const r = computeEditorialReadiness({ sections: { protocols_data: {} } }, {});
    expect(r.sections.find((s) => s.key === "supplements").filled).toBe(false);
  });
});

describe("contrats exportés", () => {
  it("EDITORIAL_SECTIONS couvre les 5 sections avec labels", () => {
    expect(EDITORIAL_SECTIONS).toHaveLength(5);
    EDITORIAL_SECTIONS.forEach((s) => {
      expect(s.key).toBeTruthy();
      expect(s.okLabel).toBeTruthy();
      expect(s.emptyLabel).toBeTruthy();
    });
  });

  it("READINESS_META a les 3 niveaux", () => {
    expect(READINESS_META.blocked.icon).toBe("🔴");
    expect(READINESS_META.review.icon).toBe("🟠");
    expect(READINESS_META.ready.icon).toBe("🟢");
  });
});
