import { describe, it, expect } from "vitest";
import { mapPublishedJourney, PHASE_STATUS_META } from "./publishedJourney";

describe("mapPublishedJourney", () => {
  it("journey_phases null → liste vide (état « aucun parcours »)", () => {
    expect(mapPublishedJourney(null)).toEqual([]);
    expect(mapPublishedJourney(undefined)).toEqual([]);
  });

  it("phases absent ou vide → liste vide", () => {
    expect(mapPublishedJourney({})).toEqual([]);
    expect(mapPublishedJourney({ phases: [] })).toEqual([]);
  });

  it("mappe order, nom client et statut tels quels", () => {
    const rows = mapPublishedJourney({
      phases: [
        { id: "p1", order: 1, client_name: "Apaisement digestif", status: "completed" },
        { id: "p2", order: 2, client_name: "Rééquilibrage", status: "active" },
        { id: "p3", order: 3, client_name: "Réparation", status: "upcoming" },
      ],
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ key: "p1", order: 1, name: "Apaisement digestif", status: "completed", marker: "✓" });
    expect(rows[1]).toMatchObject({ key: "p2", order: 2, name: "Rééquilibrage", status: "active", marker: "●" });
    expect(rows[2]).toMatchObject({ key: "p3", order: 3, name: "Réparation", status: "upcoming", marker: "○" });
  });

  it("statut inconnu ou absent → upcoming (jamais d'inférence de progression)", () => {
    const rows = mapPublishedJourney({
      phases: [{ id: "p1", order: 1, client_name: "X" }, { order: 2, client_name: "Y", status: "weird" }],
    });
    expect(rows[0].status).toBe("upcoming");
    expect(rows[1].status).toBe("upcoming");
  });

  it("fallbacks key/order/name si champs manquants", () => {
    const rows = mapPublishedJourney({ phases: [{ status: "active" }] });
    expect(rows[0]).toMatchObject({ key: "phase-0", order: 1, name: "Phase 1", status: "active" });
  });

  it("PHASE_STATUS_META couvre les 3 statuts", () => {
    expect(PHASE_STATUS_META.active.label).toBe("En cours");
    expect(PHASE_STATUS_META.completed.label).toBe("Terminée");
    expect(PHASE_STATUS_META.upcoming.label).toBe("À venir");
  });
});
