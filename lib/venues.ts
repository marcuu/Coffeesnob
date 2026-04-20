import type { OverallScoreSummary } from "@/lib/aggregation";
import { regionDisplayName, regionIdFromCityName } from "@/lib/regions";
import type { Venue } from "@/lib/types";

export function formatRating(avg: number | null): string {
  return avg === null ? "—" : avg.toFixed(1);
}

/**
 * Builds region filter options from a list of raw city strings from the DB.
 *
 * Each entry carries the `cities` array — the exact DB city strings that
 * belong to that region. The venues page uses this directly for filtering
 * (`WHERE city IN (...)`) so no separate REGION_TO_CITIES import is needed,
 * and unmapped cities always filter correctly as single-city regions.
 */
export function buildRegionFilterOptions(
  cities: Array<string | null | undefined>,
): { id: string; name: string; cities: string[] }[] {
  const seen = new Map<string, { name: string; cities: string[] }>();

  for (const city of cities) {
    const trimmed = city?.trim();
    if (!trimmed) continue;
    const regionId = regionIdFromCityName(trimmed);
    const existing = seen.get(regionId);
    if (existing) {
      if (!existing.cities.includes(trimmed)) {
        existing.cities.push(trimmed);
      }
    } else {
      seen.set(regionId, {
        name: regionDisplayName(regionId, trimmed),
        cities: [trimmed],
      });
    }
  }

  return Array.from(seen.entries())
    .map(([id, { name, cities }]) => ({ id, name, cities }))
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
