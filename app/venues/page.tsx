import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { VenueRankingMeta } from "@/components/ranking/VenueRankingMeta";
import { createClient } from "@/utils/supabase/server";
import type { Venue } from "@/lib/types";
import {
  buildRegionFilterOptions,
  sortVenuesForListing,
} from "@/lib/venues";
import { getVenueOverallScores } from "@/lib/aggregation";
import { buildRankMap, buildVenueRankingSummary } from "@/lib/ranking-context";

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
  const selectedRegionData = regions.find((r) => r.id === regionFilter);
  const selectedRegion = selectedRegionData?.id ?? "";

  // Scope label: region name when filtered, otherwise "UK".
  const scopeLabel = selectedRegionData?.name ?? "UK";

  let query = supabase
    .from("venues")
    .select("*")
    .order("created_at", { ascending: false });
  if (selectedRegionData) {
    query = query.in("city", selectedRegionData.cities);
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

  // Rank map is scoped to the current venue set (region-filtered or all UK).
  const rankMap = buildRankMap(weightedScores);
  const sortedVenues = sortVenuesForListing(venues, weightedScores, sort);

  return (
    <>
      <SiteHeader />
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

      {selectedRegion ? (
        <div className="mb-4 flex justify-end">
          <Link
            href={`/rankings/${selectedRegion}`}
            className="text-sm font-medium underline-offset-2 hover:underline"
          >
            {regions.find((r) => r.id === selectedRegion)?.name ?? selectedRegion} Rankings →
          </Link>
        </div>
      ) : null}

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
            const rank = rankMap.get(v.id) ?? null;
            const summary = buildVenueRankingSummary(v.id, ws, rank, scopeLabel);

            return (
              <li key={v.id}>
                <Link href={`/venues/${v.slug}`} className="block">
                  <Card className="transition-colors hover:bg-[var(--color-muted)]">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <CardTitle className="truncate">{v.name}</CardTitle>
                          <CardDescription>
                            {v.city} · {v.postcode}
                          </CardDescription>
                        </div>
                        <div className="shrink-0 text-right text-sm">
                          <div className="font-medium">
                            {summary.formattedScore}
                          </div>
                          <div className="text-xs text-[var(--color-muted-foreground)]">
                            {summary.rawReviewCount} review
                            {summary.rawReviewCount === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      {/* No reviewHref: card is already wrapped in <Link> */}
                      <VenueRankingMeta summary={summary} />
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
    </>
  );
}
