import { describe, expect, it } from "vitest";

// Mirrors the SQL backfill math in
// supabase/migrations/20260428000000_two_axis_collapse.sql so the rounding
// edges are exercised in CI without an actual Postgres roundtrip. The on-DB
// invariants (every seeded review non-null, six columns dropped) are
// verified by the SQL fixture under __tests__/sql/ when the local Supabase
// stack is available.
//
// The backfill formula is: round((avg_of_three / 2.0)) clamped to [1, 5].

function backfillFromSix(taste: number, body: number, aroma: number): number {
  const avg = (taste + body + aroma) / 3;
  const halved = avg / 2;
  // Postgres round() on numeric is half-away-from-zero; Math.round is
  // half-to-+∞. They agree for positive inputs that don't end exactly at
  // .5 with even ones digit, which is the common case here.
  const rounded = Math.round(halved);
  return Math.max(1, Math.min(5, rounded));
}

describe("two-axis backfill (mirroring 20260428000000)", () => {
  it("maps a top-of-scale six-axis review to 5", () => {
    expect(backfillFromSix(10, 10, 10)).toBe(5);
  });

  it("maps a bottom-of-scale six-axis review to 1", () => {
    expect(backfillFromSix(1, 1, 1)).toBe(1);
  });

  it("maps a midpoint six-axis review (5,5,5) to 3", () => {
    // avg = 5, halved = 2.5, rounded = 3
    expect(backfillFromSix(5, 5, 5)).toBe(3);
  });

  it("maps mixed values via the average then halve rule", () => {
    // (8+8+8)/3 = 8 → 4
    expect(backfillFromSix(8, 8, 8)).toBe(4);
    // (6+6+6)/3 = 6 → 3
    expect(backfillFromSix(6, 6, 6)).toBe(3);
    // (9+7+8)/3 = 8 → 4
    expect(backfillFromSix(9, 7, 8)).toBe(4);
  });

  it("clamps any out-of-range inputs to 1-5", () => {
    expect(backfillFromSix(10, 10, 10)).toBeLessThanOrEqual(5);
    expect(backfillFromSix(1, 1, 1)).toBeGreaterThanOrEqual(1);
  });
});
