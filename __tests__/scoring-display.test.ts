import { describe, expect, it } from "vitest";

import { deriveMaturity, getScoreDisplay } from "@/lib/scoring-display";
import { SCORING_CONSTANTS } from "@/lib/scoring/weights";

const THRESHOLD = SCORING_CONSTANTS.SETTLED_CONFIDENCE_THRESHOLD;

describe("deriveMaturity", () => {
  it("is forming when not displayable, regardless of confidence", () => {
    expect(deriveMaturity({ displayable: false, confidence: 0.99 })).toBe(
      "forming",
    );
    expect(deriveMaturity({ displayable: false, confidence: 0 })).toBe(
      "forming",
    );
  });

  it("is provisional when displayable but below the settled threshold", () => {
    expect(deriveMaturity({ displayable: true, confidence: 0 })).toBe(
      "provisional",
    );
    expect(
      deriveMaturity({ displayable: true, confidence: THRESHOLD - 0.0001 }),
    ).toBe("provisional");
  });

  it("is settled exactly at the threshold (inclusive boundary)", () => {
    expect(deriveMaturity({ displayable: true, confidence: THRESHOLD })).toBe(
      "settled",
    );
  });

  it("is settled above the threshold", () => {
    expect(deriveMaturity({ displayable: true, confidence: 0.95 })).toBe(
      "settled",
    );
  });

  it("treats missing confidence as zero (provisional when displayable)", () => {
    expect(deriveMaturity({ displayable: true, confidence: null })).toBe(
      "provisional",
    );
    expect(deriveMaturity({ displayable: true, confidence: undefined })).toBe(
      "provisional",
    );
  });
});

describe("getScoreDisplay", () => {
  describe("forming", () => {
    it("renders no number and is not displayable", () => {
      const r = getScoreDisplay(8.7, "forming");
      expect(r.displayable).toBe(false);
      expect(r.formattedScore).toBe("—");
      expect(r.emphasis).toBe("none");
      expect(r.description.length).toBeGreaterThan(0);
    });

    it("is forming for a null score even if maturity says otherwise", () => {
      const r = getScoreDisplay(null, "settled");
      expect(r.maturity).toBe("forming");
      expect(r.formattedScore).toBe("—");
    });
  });

  describe("provisional", () => {
    it("renders a clean whole number with no approximate notation", () => {
      expect(getScoreDisplay(8.3, "provisional").formattedScore).toBe("8");
      expect(getScoreDisplay(6.6, "provisional").formattedScore).toBe("7");
      expect(getScoreDisplay(7.0, "provisional").formattedScore).toBe("7");
    });

    it("reads at muted emphasis and is displayable", () => {
      const r = getScoreDisplay(7.4, "provisional");
      expect(r.emphasis).toBe("muted");
      expect(r.displayable).toBe(true);
      expect(r.maturity).toBe("provisional");
    });

    it("never produces a decimal or approximate notation", () => {
      for (let s = 1; s <= 10; s += 0.1) {
        const out = getScoreDisplay(s, "provisional").formattedScore;
        expect(out).not.toMatch(/\d\.\d/);
        expect(out).not.toMatch(/[~≈]/);
        expect(out).not.toMatch(/\d\s*[–-]\s*\d/);
      }
    });
  });

  describe("settled", () => {
    it("renders full one-decimal precision", () => {
      expect(getScoreDisplay(8.266, "settled").formattedScore).toBe("8.3");
      expect(getScoreDisplay(9.0, "settled").formattedScore).toBe("9.0");
      expect(getScoreDisplay(7.56, "settled").formattedScore).toBe("7.6");
    });

    it("reads at full emphasis and earns its decimal", () => {
      const r = getScoreDisplay(8.0, "settled");
      expect(r.emphasis).toBe("full");
      expect(r.maturity).toBe("settled");
      expect(r.formattedScore).toMatch(/^\d+\.\d$/);
    });
  });

  describe("tone bands (independent of maturity)", () => {
    const cases: Array<[number, string]> = [
      [9.0, "exceptional"],
      [8.5, "outstanding"],
      [8.0, "excellent"],
      [7.5, "strong"],
      [7.0, "good"],
      [6.9, "ranked"],
      [1.0, "ranked"],
    ];
    for (const [score, tone] of cases) {
      it(`${score} → ${tone}`, () => {
        expect(getScoreDisplay(score, "settled").tone).toBe(tone);
        expect(getScoreDisplay(score, "provisional").tone).toBe(tone);
      });
    }
  });
});
