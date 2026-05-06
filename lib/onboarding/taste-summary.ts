// Rule-based taste-summary generator. Produces up to 3 lines from a pool
// of templates given a reviewer's priming reviews. Pre-written copy keeps
// the snob-coded tone consistent without requiring an LLM. PRD §5.3 +
// §6 FR5.
//
// Each rule is a predicate over the priming-review feature set. Rules are
// evaluated in priority order; the first 3 that fire produce the summary.
// Rules can include a `metricKey` so analytics can record which lines hit
// for which users (PRD risk 2 mitigation).

import type { ReviewBucket } from "@/lib/types";

export type TasteSummaryReview = {
  venueId: string;
  venueName: string;
  bucket: ReviewBucket;
  ratingCoffee5: number;
  ratingVibe5: number;
  // venue tags lifted from the curated list (e.g. "purist", "chain",
  // "roaster", "filter-led"). Optional; rules degrade gracefully when absent.
  tags?: string[];
};

export type TasteSummaryLine = {
  key: string;
  text: string;
};

type Rule = {
  key: string;
  // Returns the formatted line, or null to skip this rule.
  apply: (reviews: TasteSummaryReview[], stats: Stats) => string | null;
};

type Stats = {
  count: number;
  byBucket: Record<ReviewBucket, TasteSummaryReview[]>;
  avgCoffee: number;
  avgVibe: number;
  pilgrimageVenues: TasteSummaryReview[];
  chainCount: number;
  hasChainsInPilgrimage: boolean;
  hasChainsInConvenience: boolean;
};

function buildStats(reviews: TasteSummaryReview[]): Stats {
  const byBucket: Record<ReviewBucket, TasteSummaryReview[]> = {
    pilgrimage: [],
    detour: [],
    convenience: [],
  };
  for (const r of reviews) byBucket[r.bucket].push(r);

  const avgCoffee =
    reviews.length === 0
      ? 0
      : reviews.reduce((s, r) => s + r.ratingCoffee5, 0) / reviews.length;
  const avgVibe =
    reviews.length === 0
      ? 0
      : reviews.reduce((s, r) => s + r.ratingVibe5, 0) / reviews.length;

  const isChain = (r: TasteSummaryReview) => r.tags?.includes("chain") ?? false;
  return {
    count: reviews.length,
    byBucket,
    avgCoffee,
    avgVibe,
    pilgrimageVenues: byBucket.pilgrimage,
    chainCount: reviews.filter(isChain).length,
    hasChainsInPilgrimage: byBucket.pilgrimage.some(isChain),
    hasChainsInConvenience: byBucket.convenience.some(isChain),
  };
}

function listVenues(rs: TasteSummaryReview[], max = 2): string {
  const names = rs.slice(0, max).map((r) => r.venueName);
  return names.join(", ");
}

const RULES: Rule[] = [
  {
    key: "coffee_over_vibe",
    apply: (_, s) =>
      s.count >= 3 && s.avgCoffee > s.avgVibe + 0.8
        ? "Coffee quality matters more to you than ambience."
        : null,
  },
  {
    key: "vibe_over_coffee",
    apply: (_, s) =>
      s.count >= 3 && s.avgVibe > s.avgCoffee + 0.8
        ? "The room matters as much as the cup — you reward a good vibe."
        : null,
  },
  {
    key: "purist_pilgrimage",
    apply: (_, s) => {
      const purist = s.pilgrimageVenues.filter(
        (r) => r.tags?.includes("purist") || r.tags?.includes("roaster"),
      );
      if (purist.length >= 2) {
        return `Your Pilgrimage venues lean toward purist roasters (${listVenues(purist)}).`;
      }
      return null;
    },
  },
  {
    key: "chains_anchored_low",
    apply: (_, s) =>
      s.chainCount >= 2 && !s.hasChainsInPilgrimage
        ? "You're firmly in third-wave territory — chains don't make your map."
        : null,
  },
  {
    key: "chains_in_pilgrimage",
    apply: (_, s) =>
      s.hasChainsInPilgrimage
        ? "You don't have a third-wave bias — convenience and quality both count."
        : null,
  },
  {
    key: "high_bar",
    apply: (_, s) =>
      s.count >= 3 && s.avgCoffee >= 4.4
        ? "Your bar is high — most cups in your set scored 4 or 5."
        : null,
  },
  {
    key: "broad_geography",
    apply: (rs, s) => {
      if (s.count < 3) return null;
      // crude "regions visited" proxy via city mentions in venue names is
      // unreliable; if more than half the priming reviews are pilgrimage,
      // call it commitment.
      const pilg = s.byBucket.pilgrimage.length;
      if (pilg / s.count > 0.5) {
        return `You're generous with Pilgrimage — ${pilg} of your ${rs.length} venues earned the badge.`;
      }
      return null;
    },
  },
  {
    key: "selective",
    apply: (rs, s) => {
      if (s.count < 3) return null;
      const pilg = s.byBucket.pilgrimage.length;
      if (pilg === 0) {
        return "Nothing earned a Pilgrimage yet — you save the top tier for when it really counts.";
      }
      if (pilg / s.count < 0.2) {
        return `You're selective — only ${pilg} of ${rs.length} earned a Pilgrimage.`;
      }
      return null;
    },
  },
  {
    key: "filter_led",
    apply: (rs, _s) => {
      const filterFans = rs.filter((r) => r.tags?.includes("filter-led"));
      if (filterFans.length >= 2 && filterFans.every((r) => r.bucket !== "convenience")) {
        return "You score the filter-led shops higher than the espresso-only ones.";
      }
      return null;
    },
  },
  {
    key: "regional",
    apply: (rs, _s) => {
      const cities = new Set(
        rs.map((r) => r.tags?.find((t) => t.startsWith("city:"))).filter(Boolean) as string[],
      );
      if (cities.size >= 3) {
        return "Your set spans multiple UK cities — you don't restrict yourself to one scene.";
      }
      return null;
    },
  },
  {
    key: "thin_profile",
    apply: (_, s) =>
      s.count <= 2
        ? "Your profile is provisional — rank a few more venues for sharper personalisation."
        : null,
  },
  {
    key: "balanced",
    apply: (_, s) =>
      s.count >= 3 &&
      Math.abs(s.avgCoffee - s.avgVibe) <= 0.4 &&
      s.avgCoffee >= 3 &&
      s.avgCoffee <= 4.2
        ? "Coffee and vibe weigh evenly for you — neither one carries the whole experience."
        : null,
  },
  {
    key: "fallback_first",
    apply: (rs, s) =>
      s.count > 0
        ? `You opened your map with ${rs[0].venueName} — a useful anchor for what comes next.`
        : null,
  },
  {
    key: "fallback_count",
    apply: (rs) =>
      `You ranked ${rs.length} venue${rs.length === 1 ? "" : "s"} to start — your taste profile begins here.`,
  },
];

// Returns up to `max` summary lines, in rule-priority order. Always at
// least one line for any non-empty input thanks to the fallbacks at the
// bottom.
export function generateTasteSummary(
  reviews: TasteSummaryReview[],
  max = 3,
): TasteSummaryLine[] {
  const stats = buildStats(reviews);
  const out: TasteSummaryLine[] = [];
  for (const rule of RULES) {
    if (out.length >= max) break;
    const text = rule.apply(reviews, stats);
    if (text) out.push({ key: rule.key, text });
  }
  return out;
}
