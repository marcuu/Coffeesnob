import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import type { Venue } from "@/lib/types";
import { REGION_TO_CITIES } from "@/lib/regions";
import {
  buildRegionFilterOptions,
  formatRating,
  sortVenuesForListing,
} from "@/lib/venues";
import { getVenueOverallScores } from "@/lib/aggregation";

export const dynamic = "force-dynamic";

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; sort?: string }>;
}) {
  const { region, sort } = await searchParams;
  const regionFilter = region?.trim() ?? "";

  const supabase = await createClient();

  // Full list of distinct cities for deriving regions, independent of the filter.
  const { data: cityRows } = await supabase
    .from("venues")
    .select("city")
    .order("city", { ascending: true });
  const regions = buildRegionFilterOptions((cityRows ?? []).map((r) => r.city));
  const selectedRegion = regions.find((r) => r.id === regionFilter)?.id ?? "";

  let query = supabase
    .from("venues")
    .select("*")
    .order("created_at", { ascending: false });
  if (selectedRegion) {
    const citiesForRegion = REGION_TO_CITIES[selectedRegion];
    if (citiesForRegion) {
      query = query.in("city", citiesForRegion);
    }
  }
  const { data, error } = await query;

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Venues</h1>
        <p className="mt-4 text-sm text-[var(--color-destructive)]">
          {error.message}
        </p>
      </main>
    );
  }

  const venues = (data ?? []) as Venue[];
  const weightedScores =
    venues.length > 0
      ? await getVenueOverallScores(
          supabase,
          venues.map((v) => v.id),
        )
      : new Map();
  const sortedVenues = sortVenuesForListing(venues, weightedScores, sort);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Venues</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            UK third-wave coffee spots rated by the community.
          </p>
        </div>
        <Button asChild>
          <Link href="/venues/new">Add venue</Link>
        </Button>
      </div>

      <form
        action="/venues"
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <div className="grid flex-1 gap-1.5">
          <label htmlFor="region" className="text-xs font-medium">
            Filter by region
          </label>
          <select
            id="region"
            name="region"
            defaultValue={selectedRegion}
            className="flex h-10 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] ring-offset-background dark:[color-scheme:dark]"
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option
                key={r.id}
                value={r.id}
                className="bg-[var(--color-background)] text-[var(--color-foreground)]"
              >
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {selectedRegion ? (
          <Button asChild variant="ghost">
            <Link href="/venues">Clear</Link>
          </Button>
        ) : null}
      </form>

      {sortedVenues.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {selectedRegion
            ? `No venues found in "${regions.find((r) => r.id === selectedRegion)?.name ?? selectedRegion}".`
            : "No venues yet — add the first."}
        </p>
      ) : (
        <ul className="grid gap-4">
          {sortedVenues.map((v) => {
            const ws = weightedScores.get(v.id);
            const displayScore = ws?.displayable ? ws.score : null;
            const reviewCount = ws?.rawReviewCount ?? 0;
            return (
              <li key={v.id}>
                <Link href={`/venues/${v.slug}`} className="block">
                  <Card className="transition-colors hover:bg-[var(--color-muted)]">
                    <CardHeader>
                      <div className="flex items-baseline justify-between gap-4">
                        <CardTitle>{v.name}</CardTitle>
                        <div className="text-right text-sm">
                          <div className="font-medium">
                            {formatRating(displayScore)}
                          </div>
                          <div className="text-xs text-[var(--color-muted-foreground)]">
                            {reviewCount} review
                            {reviewCount === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      <CardDescription>
                        {v.city} · {v.postcode}
                      </CardDescription>
                    </CardHeader>
                    {v.roasters.length || v.brew_methods.length ? (
                      <CardContent className="flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]">
                        {v.roasters.map((r) => (
                          <span
                            key={`r-${r}`}
                            className="rounded-full border border-[var(--color-border)] px-2 py-0.5"
                          >
                            {r}
                          </span>
                        ))}
                        {v.brew_methods.map((b) => (
                          <span
                            key={`b-${b}`}
                            className="rounded-full bg-[var(--color-muted)] px-2 py-0.5"
                          >
                            {b.replace("_", " ")}
                          </span>
                        ))}
                      </CardContent>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
