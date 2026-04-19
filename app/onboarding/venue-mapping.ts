// Map Supabase rows into the onboarding's venue shape.
// Flavour axes aren't stored in the DB; we overlay a small hand-curated map
// keyed by slug for the seeded venues. Unknown venues fall back to empty axes
// (the ranker still uses city + drink + weighted score for those).

import type { OverallScoreSummary } from "@/lib/aggregation";
import type { BrewMethod, Venue as DbVenue } from "@/lib/types";

import type { Axes, City, DrinkId, OnboardingVenue } from "./data";

export function cityIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

const FLAVOUR_OVERLAY: Record<string, Axes> = {
  "prufrock-coffee": { fruit: 0.9, floral: 0.5, classic: 0.5 },
  "kaffeine-fitzrovia": { classic: 0.9, choc: 0.7, nutty: 0.6 },
  "ozone-shoreditch": { classic: 0.8, choc: 0.7, nutty: 0.5 },
  "north-star-leeds": { choc: 0.8, nutty: 0.7, classic: 0.7 },
};

export function mapBrewMethodsToDrinks(
  methods: BrewMethod[],
  hasPlantMilk: boolean | null,
): DrinkId[] {
  const drinks = new Set<DrinkId>();
  for (const m of methods) {
    if (m === "espresso") {
      drinks.add("espresso");
      drinks.add("milky");
    } else if (
      m === "filter" ||
      m === "pour_over" ||
      m === "batch_brew" ||
      m === "aeropress"
    ) {
      drinks.add("filter");
    } else if (m === "cold_brew") {
      drinks.add("cold");
    }
  }
  if (hasPlantMilk) drinks.add("milky");
  return Array.from(drinks);
}

function formatProof(
  reviewCount: number,
  score: number | null,
  displayable: boolean,
): string {
  if (!reviewCount) return "No reviews yet — be the first.";
  const rev = `${reviewCount} review${reviewCount === 1 ? "" : "s"}`;
  if (displayable && score !== null) {
    return `${rev}, weighted score ${score.toFixed(1)}.`;
  }
  return `${rev}. Not enough weight yet to display a composite score.`;
}

function pitchFromNotes(notes: string | null, name: string): string {
  const trimmed = notes?.trim();
  if (!trimmed) return `Add ${name} to your list — no blurb yet.`;
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177).trimEnd()}…`;
}

export function mapDbVenuesToOnboarding(
  venues: DbVenue[],
  scores: Map<string, OverallScoreSummary>,
): OnboardingVenue[] {
  return venues.map((v) => {
    const ws = scores.get(v.id);
    const displayable = !!ws?.displayable;
    const score = displayable ? ws!.score : 0;
    const reviews = ws?.rawReviewCount ?? 0;
    const area = cityIdFromName(v.city);
    const axes = FLAVOUR_OVERLAY[v.slug] ?? {};
    return {
      slug: v.slug,
      name: v.name,
      city: v.city,
      area,
      roaster: v.roasters[0] ?? "Independent",
      axes,
      drinks: mapBrewMethodsToDrinks(v.brew_methods, v.has_plant_milk),
      score,
      reviews,
      pitch: pitchFromNotes(v.notes, v.name),
      proof: formatProof(reviews, displayable ? ws!.score : null, displayable),
    };
  });
}

export function buildCityOptions(venues: OnboardingVenue[]): City[] {
  const byId = new Map<string, City>();
  for (const v of venues) {
    const existing = byId.get(v.area);
    if (existing) {
      existing.venues += 1;
    } else {
      byId.set(v.area, { id: v.area, name: v.city, venues: 1 });
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
