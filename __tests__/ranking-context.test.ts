import { describe, expect, it } from "vitest";

import type { OverallScoreSummary } from "@/lib/aggregation";
import {
  buildRankMap,
  buildVenueRankingSummary,
  computeRank,
} from "@/lib/ranking-context";

const makeScore = (
  score: number,
  displayable: boolean,
  rawReviewCount = 5,
  confidence = 0.8,
): OverallScoreSummary => ({ score, confidence, rawReviewCount, displayable });

describe("buildVenueRankingSummary", () => {
  describe("ranked venues", () => {
    it("returns displayable=true and isUnranked=false for a ranked venue", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.5, true),
        1,
        "UK",
      );
      expect(summary.displayable).toBe(true);
      expect(summary.isUnranked).toBe(false);
    });

    it("carries the supplied rank and scopeLabel", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(9.0, true),
        4,
        "London",
      );
      expect(summary.rank).toBe(4);
      expect(summary.scopeLabel).toBe("London");
    });

    it("formats the score to one decimal place", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.266, true),
        1,
        "UK",
      );
      expect(summary.formattedScore).toBe("8.3");
    });

    it("derives scoreLabel from the score band", () => {
      expect(
        buildVenueRankingSummary("a", makeScore(9.1, true), 1, "UK").scoreLabel,
      ).toBe("Exceptional");
      expect(
        buildVenueRankingSummary("a", makeScore(8.7, true), 1, "UK").scoreLabel,
      ).toBe("Outstanding");
      expect(
        buildVenueRankingSummary("a", makeScore(8.2, true), 1, "UK").scoreLabel,
      ).toBe("Excellent");
    });

    it("sets reviewPrompt to the debate copy for ranked venues", () => {
      const { reviewPrompt } = buildVenueRankingSummary(
        "a",
        makeScore(8.5, true),
        1,
        "UK",
      );
      expect(reviewPrompt).toContain("Think this ranking is wrong");
    });

    it("returns High signal for confidence ≥ 0.7", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.0, true, 5, 0.75),
        1,
        "UK",
      );
      expect(summary.signalLabel).toBe("High signal");
    });

    it("returns Good signal for confidence in [0.4, 0.7)", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.0, true, 3, 0.5),
        1,
        "UK",
      );
      expect(summary.signalLabel).toBe("Good signal");
    });

    it("returns Low signal for confidence in [0.2, 0.4)", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(7.5, true, 2, 0.25),
        1,
        "UK",
      );
      expect(summary.signalLabel).toBe("Low signal");
    });

    it("rank can be null for a ranked venue with no pre-computed rank", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.5, true),
        null,
        "UK",
      );
      expect(summary.rank).toBeNull();
      expect(summary.isUnranked).toBe(false);
    });
  });

  describe("unranked venues", () => {
    it("returns displayable=false and isUnranked=true when displayable flag is false", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.5, false),
        null,
        "UK",
      );
      expect(summary.displayable).toBe(false);
      expect(summary.isUnranked).toBe(true);
    });

    it("returns isUnranked=true when scoreEntry is undefined", () => {
      const summary = buildVenueRankingSummary("a", undefined, null, "UK");
      expect(summary.isUnranked).toBe(true);
      expect(summary.rawReviewCount).toBe(0);
    });

    it("sets reviewPrompt to 'No reviews yet.' when rawReviewCount is 0", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(5.0, false, 0),
        null,
        "UK",
      );
      expect(summary.reviewPrompt).toBe("No reviews yet.");
    });

    it("sets reviewPrompt to 'Needs more trusted reviews...' when reviews > 0 but unranked", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(5.0, false, 3),
        null,
        "UK",
      );
      expect(summary.reviewPrompt).toBe(
        "Needs more trusted reviews to enter the rankings.",
      );
    });

    it("returns Needs signal label for unranked venues", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(5.0, false, 1, 0.1),
        null,
        "UK",
      );
      expect(summary.signalLabel).toBe("Needs signal");
    });

    it("formattedScore is em-dash for unranked", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(5.0, false),
        null,
        "UK",
      );
      expect(summary.formattedScore).toBe("—");
    });
  });

  describe("scope labels", () => {
    it("surfaces scopeLabel unchanged in the summary", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.0, true),
        2,
        "Yorkshire",
      );
      expect(summary.scopeLabel).toBe("Yorkshire");
    });

    it("works with any string scope label", () => {
      const summary = buildVenueRankingSummary(
        "a",
        makeScore(8.0, true),
        3,
        "North West",
      );
      expect(summary.scopeLabel).toBe("North West");
    });
  });
});

describe("buildRankMap", () => {
  it("only includes displayable venues", () => {
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(9.0, true)],
      ["b", makeScore(8.0, false)],
      ["c", makeScore(7.0, true)],
    ]);
    const rankMap = buildRankMap(scores);
    expect(rankMap.has("a")).toBe(true);
    expect(rankMap.has("b")).toBe(false);
    expect(rankMap.has("c")).toBe(true);
  });

  it("assigns ranks in score-descending order starting at 1", () => {
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(7.0, true)],
      ["b", makeScore(9.5, true)],
      ["c", makeScore(8.0, true)],
    ]);
    const rankMap = buildRankMap(scores);
    expect(rankMap.get("b")).toBe(1);
    expect(rankMap.get("c")).toBe(2);
    expect(rankMap.get("a")).toBe(3);
  });

  it("returns an empty map when all venues are unranked", () => {
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(5.0, false)],
    ]);
    expect(buildRankMap(scores).size).toBe(0);
  });

  it("returns an empty map for an empty input", () => {
    expect(buildRankMap(new Map()).size).toBe(0);
  });
});

describe("computeRank", () => {
  it("returns the correct rank for a displayable venue", () => {
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(8.0, true)],
      ["b", makeScore(9.0, true)],
    ]);
    expect(computeRank("a", scores)).toBe(2);
    expect(computeRank("b", scores)).toBe(1);
  });

  it("returns null for a non-displayable venue", () => {
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(8.0, false)],
    ]);
    expect(computeRank("a", scores)).toBeNull();
  });

  it("returns null for a venue not in the scores map", () => {
    expect(computeRank("missing", new Map())).toBeNull();
  });
});
