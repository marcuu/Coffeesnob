// Pure helpers for the reviewer profile page. No DB access.

import type { Reviewer } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewForProfile = {
  rating_overall: number;
  rating_taste: number | null;
  rating_body: number | null;
  rating_aroma: number | null;
  rating_ambience: number;
  rating_service: number;
  rating_value: number;
  body: string;
  visited_on: string;
  venue: {
    city: string;
    brew_methods: string[];
  };
};

export type TasteProfile = {
  chips: string[];
  descriptor: string;
};

export type ReputationTier = {
  label: string;
  description: string;
  nextStep: string | null;
};

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Returns the number of consecutive calendar weeks (rolling 7-day buckets)
// with at least one review, counting back from the most recent week.
// A break of more than 1 week resets the streak.
// `now` defaults to the current time; pass an explicit value in tests.
export function computeStreak(visitedDates: string[], now: Date = new Date()): number {
  if (visitedDates.length === 0) return 0;

  const currentWeekIndex = Math.floor(now.getTime() / MS_PER_WEEK);

  const weekIndices = new Set<number>();
  for (const dateStr of visitedDates) {
    const ts = new Date(dateStr).getTime();
    if (!Number.isFinite(ts)) continue;
    weekIndices.add(Math.floor(ts / MS_PER_WEEK));
  }

  const sorted = [...weekIndices].sort((a, b) => b - a);
  if (sorted.length === 0) return 0;

  // Only count streak if the most recent week is this week or last week.
  if (sorted[0] < currentWeekIndex - 1) return 0;

  let streak = 0;
  let expected = sorted[0];
  for (const w of sorted) {
    if (w === expected) {
      streak++;
      expected--;
    } else {
      break;
    }
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Taste profile
// ---------------------------------------------------------------------------

export function deriveTasteProfile(
  reviews: ReviewForProfile[],
): TasteProfile | null {
  if (reviews.length < 3) return null;

  let totalCoffee = 0;
  let countCoffee = 0;
  let totalExp = 0;
  let totalOverall = 0;

  for (const r of reviews) {
    const coffeeScores = [r.rating_taste, r.rating_body, r.rating_aroma].filter(
      (v): v is number => v !== null && v !== undefined,
    );
    if (coffeeScores.length > 0) {
      totalCoffee += coffeeScores.reduce((a, b) => a + b, 0) / coffeeScores.length;
      countCoffee++;
    }
    totalExp +=
      (r.rating_ambience + r.rating_service + r.rating_value) / 3;
    totalOverall += r.rating_overall;
  }

  const avgCoffee = countCoffee > 0 ? totalCoffee / countCoffee : null;
  const avgExp = totalExp / reviews.length;
  const avgOverall = totalOverall / reviews.length;

  const chips: string[] = [];

  // Coffee vs experience priority
  if (avgCoffee !== null) {
    if (avgCoffee > avgExp + 0.5) chips.push("Coffee-first");
    else if (avgExp > avgCoffee + 0.5) chips.push("Experience-focused");
    else chips.push("Balanced");
  }

  // Rating strictness
  if (avgOverall < 6.0) chips.push("Strict");
  else if (avgOverall > 7.5) chips.push("Generous");
  else chips.push("Fair");

  // Brew method preference across reviewed venues
  const allMethods = reviews.flatMap((r) => r.venue.brew_methods);
  if (allMethods.length > 0) {
    const espresso = allMethods.filter((m) => m === "espresso").length;
    const filter = allMethods.filter((m) =>
      ["filter", "pour_over", "batch_brew", "aeropress", "cold_brew"].includes(m),
    ).length;
    if (espresso > filter * 1.5) chips.push("Espresso-led");
    else if (filter > espresso * 1.5) chips.push("Filter-led");
  }

  // City concentration
  const cityMap = new Map<string, number>();
  for (const r of reviews) {
    const c = r.venue.city;
    cityMap.set(c, (cityMap.get(c) ?? 0) + 1);
  }
  const topEntry = [...cityMap.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topEntry && topEntry[1] / reviews.length > 0.6) {
    chips.push(`${topEntry[0]}-focused`);
  }

  return { chips, descriptor: chips.join(" · ") };
}

// ---------------------------------------------------------------------------
// Reputation tier
// ---------------------------------------------------------------------------

export function computeReputationTier(
  reviewer: Pick<Reviewer, "status" | "review_count">,
  tenure: { tenure_score: number; consistency_score: number } | null,
): ReputationTier {
  const { status, review_count } = reviewer;
  const tenureScore = tenure?.tenure_score ?? 0;

  if (status === "beaned") {
    return {
      label: "Trusted contributor",
      description:
        "Pre-vetted reviewer. Your scores carry full weight in venue rankings.",
      nextStep: null,
    };
  }

  if (tenureScore >= 0.8 && review_count >= 20) {
    return {
      label: "Established reviewer",
      description:
        "Your review history gives your scores strong weight in venue rankings.",
      nextStep: null,
    };
  }

  if (tenureScore >= 0.4 || review_count >= 5) {
    const needed = Math.max(0, 20 - review_count);
    return {
      label: "Growing signal",
      description:
        "Your scores are gaining weight as your review history builds.",
      nextStep:
        needed > 0
          ? `${needed} more review${needed === 1 ? "" : "s"} to reach Established reviewer`
          : "Keep your streak going to increase your weight",
    };
  }

  const needed = Math.max(0, 5 - review_count);
  return {
    label: "Building your record",
    description:
      "Early-stage reviewer. Every review adds to your signal in the ranking system.",
    nextStep:
      needed > 0
        ? `Write ${needed} more review${needed === 1 ? "" : "s"} to start growing your signal`
        : "Keep reviewing to strengthen your weight",
  };
}

// ---------------------------------------------------------------------------
// Relative date formatting
// ---------------------------------------------------------------------------

// `now` defaults to the current time; pass an explicit value in tests.
export function formatRelativeDate(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? "" : "s"} ago`;
}

export function formatJoinDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}
