export function formatRating(avg: number | null): string {
  return avg === null ? "—" : avg.toFixed(1);
}
