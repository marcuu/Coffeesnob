import { describe, expect, it } from "vitest";

import { getScoreDisplay } from "@/lib/scoring-display";

describe("getScoreDisplay", () => {
  describe("unranked states", () => {
    it("returns Unranked for null score", () => {
      const result = getScoreDisplay(null, true);
      expect(result.displayable).toBe(false);
      expect(result.label).toBe("Unranked");
      expect(result.tone).toBe("unranked");
      expect(result.formattedScore).toBe("—");
    });

    it("returns Unranked for undefined score", () => {
      const result = getScoreDisplay(undefined, true);
      expect(result.displayable).toBe(false);
      expect(result.label).toBe("Unranked");
    });

    it("returns Unranked when displayable is false even with a valid score", () => {
      const result = getScoreDisplay(8.7, false);
      expect(result.displayable).toBe(false);
      expect(result.label).toBe("Unranked");
      expect(result.formattedScore).toBe("—");
    });

    it("returns Unranked for null score and displayable false", () => {
      const result = getScoreDisplay(null, false);
      expect(result.displayable).toBe(false);
      expect(result.tone).toBe("unranked");
    });
  });

  describe("score band boundaries", () => {
    it("9.0 → Exceptional", () => {
      const result = getScoreDisplay(9.0, true);
      expect(result.label).toBe("Exceptional");
      expect(result.tone).toBe("exceptional");
      expect(result.displayable).toBe(true);
      expect(result.formattedScore).toBe("9.0");
    });

    it("10.0 → Exceptional", () => {
      expect(getScoreDisplay(10.0, true).label).toBe("Exceptional");
    });

    it("8.9 → Outstanding (just below Exceptional threshold)", () => {
      const result = getScoreDisplay(8.9, true);
      expect(result.label).toBe("Outstanding");
      expect(result.tone).toBe("outstanding");
      expect(result.formattedScore).toBe("8.9");
    });

    it("8.5 → Outstanding (lower boundary)", () => {
      expect(getScoreDisplay(8.5, true).label).toBe("Outstanding");
    });

    it("8.4 → Excellent (just below Outstanding threshold)", () => {
      expect(getScoreDisplay(8.4, true).label).toBe("Excellent");
      expect(getScoreDisplay(8.4, true).tone).toBe("excellent");
    });

    it("8.0 → Excellent (lower boundary)", () => {
      expect(getScoreDisplay(8.0, true).label).toBe("Excellent");
    });

    it("7.9 → Strong (just below Excellent threshold)", () => {
      expect(getScoreDisplay(7.9, true).label).toBe("Strong");
      expect(getScoreDisplay(7.9, true).tone).toBe("strong");
    });

    it("7.5 → Strong (lower boundary)", () => {
      expect(getScoreDisplay(7.5, true).label).toBe("Strong");
    });

    it("7.4 → Good (just below Strong threshold)", () => {
      expect(getScoreDisplay(7.4, true).label).toBe("Good");
      expect(getScoreDisplay(7.4, true).tone).toBe("good");
    });

    it("7.0 → Good (lower boundary)", () => {
      expect(getScoreDisplay(7.0, true).label).toBe("Good");
    });

    it("6.9 → Ranked (below all named bands)", () => {
      const result = getScoreDisplay(6.9, true);
      expect(result.label).toBe("Ranked");
      expect(result.tone).toBe("ranked");
      expect(result.displayable).toBe(true);
    });

    it("1.0 → Ranked", () => {
      expect(getScoreDisplay(1.0, true).label).toBe("Ranked");
    });
  });

  describe("formattedScore precision", () => {
    it("formats to one decimal place", () => {
      expect(getScoreDisplay(8.266, true).formattedScore).toBe("8.3");
      expect(getScoreDisplay(9.0, true).formattedScore).toBe("9.0");
      expect(getScoreDisplay(7.56, true).formattedScore).toBe("7.6");
    });
  });

  describe("description field", () => {
    it("all displayable bands have non-empty description", () => {
      const scores = [9.5, 8.7, 8.2, 7.7, 7.2, 6.0];
      for (const score of scores) {
        expect(getScoreDisplay(score, true).description.length).toBeGreaterThan(
          0,
        );
      }
    });

    it("unranked has a description", () => {
      expect(getScoreDisplay(null, false).description.length).toBeGreaterThan(0);
    });
  });
});
