export function formatRating(avg: number | null): string {
  return avg === null ? "—" : avg.toFixed(1);
}

export function buildCityFilterOptions(
  cities: Array<string | null | undefined>,
): string[] {
  const unique = new Set<string>();

  for (const city of cities) {
    const trimmed = city?.trim();
    if (!trimmed) {
      continue;
    }

    unique.add(trimmed);
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}
