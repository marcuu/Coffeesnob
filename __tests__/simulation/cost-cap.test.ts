import { describe, expect, it } from "vitest";

import { runSimulationTick } from "@/simulation/lib/tick";

function fakeSupabase() {
  return {
    from(table: string) {
      if (table === "simulation_ticks") {
        return {
          select() {
            return {
              gte: async () => ({ data: [{ total_cost_usd: 20 }], error: null }),
            };
          },
          insert: async () => ({ data: null, error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("runSimulationTick", () => {
  it("stops before generation when the monthly cost cap is reached", async () => {
    const report = await runSimulationTick(fakeSupabase() as never, { now: new Date("2026-05-06T00:00:00Z") });
    expect(report.reviewsGenerated).toBe(0);
    expect(report.notes).toContain("monthly cost cap reached");
  });
});
