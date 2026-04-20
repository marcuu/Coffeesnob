import type { OverallScoreSummary } from "@/lib/aggregation";
import { REGION_NAMES, regionIdFromCityName } from "@/lib/regions";
import type { Venue } from "@/lib/types";

export function formatRating(avg: number | null): string {
  return avg === null ? "—" : avg.toFixed(1);
}

export function buildRegionFilterOptions(
  cities: Array<string | null | undefined>,
): { id: string; name: string }[] {
  const seen = new Map<string, string>();

  for (const city of cities) {
    const trimmed = city?.trim();
    if (!trimmed) continue;
    const regionId = regionIdFromCityName(trimmed);
    const regionName = REGION_NAMES[regionId] ?? trimmed;
    seen.set(regionId, regionName);
  }

  return Array.from(seen.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function sortVenuesForListing(
  venues: Venue[],
  weightedScores: Map<string, OverallScoreSummary>,
  sort?: string,
): Venue[] {
  // Keep non-default sorting modes untouched so explicit options can override
  // this fallback as we add more sort choices.
  if (sort && sort !== "score_desc") {
    return venues;
  }

  return [...venues].sort((a, b) => {
    const scoreA = weightedScores.get(a.id);
    const scoreB = weightedScores.get(b.id);
    const sortableA =
      scoreA && scoreA.displayable ? scoreA.score : Number.NEGATIVE_INFINITY;
    const sortableB =
      scoreB && scoreB.displayable ? scoreB.score : Number.NEGATIVE_INFINITY;

    if (sortableA !== sortableB) {
      return sortableB - sortableA;
    }

    const createdAtDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return a.name.localeCompare(b.name);
  });
}
