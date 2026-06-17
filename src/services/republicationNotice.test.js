import { describe, it, expect } from "vitest";
import { describeRepublication } from "./republicationNotice";

const NOW = new Date("2026-06-17T12:00:00Z");

describe("describeRepublication", () => {
  it("entrée absente / invalide → null", () => {
    expect(describeRepublication(null, NOW)).toBeNull();
    expect(describeRepublication(undefined, NOW)).toBeNull();
    expect(describeRepublication("nope", NOW)).toBeNull();
  });

  it("jamais publié (published_at absent) → null", () => {
    expect(describeRepublication({ visible_now: false, published_at: null }, NOW)).toBeNull();
    expect(describeRepublication({ visible_now: true }, NOW)).toBeNull();
  });

  it("déjà publié et visible → variant published, date = published_at", () => {
    const r = describeRepublication(
      { published_at: "2026-06-01T09:00:00Z", visible_now: true, effective_at: "2026-06-01T09:00:00Z" },
      NOW
    );
    expect(r).toEqual({ variant: "published", dateISO: "2026-06-01T09:00:00Z" });
  });

  it("effective_at futur → variant scheduled, date = effective_at (prime sur published)", () => {
    const r = describeRepublication(
      { published_at: "2026-06-01T09:00:00Z", visible_now: false, effective_at: "2026-07-01T09:00:00Z" },
      NOW
    );
    expect(r).toEqual({ variant: "scheduled", dateISO: "2026-07-01T09:00:00Z" });
  });

  it("scheduled prime même si visible_now true (date d'effet future)", () => {
    const r = describeRepublication(
      { published_at: "2026-06-01T09:00:00Z", visible_now: true, effective_at: "2026-07-01T09:00:00Z" },
      NOW
    );
    expect(r.variant).toBe("scheduled");
  });

  it("publié mais non visible et pas de date future → null (fail-closed)", () => {
    const r = describeRepublication(
      { published_at: "2026-06-01T09:00:00Z", visible_now: false, effective_at: "2026-06-01T09:00:00Z" },
      NOW
    );
    expect(r).toBeNull();
  });

  it("effective_at illisible mais visible → published (pas de crash)", () => {
    const r = describeRepublication(
      { published_at: "2026-06-01T09:00:00Z", visible_now: true, effective_at: "pas une date" },
      NOW
    );
    expect(r).toEqual({ variant: "published", dateISO: "2026-06-01T09:00:00Z" });
  });
});
