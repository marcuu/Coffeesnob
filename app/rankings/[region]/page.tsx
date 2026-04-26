import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getVenueOverallScores } from "@/lib/aggregation";
import { buildRankings } from "@/lib/rankings";
import { buildRegionFilterOptions } from "@/lib/venues";
import { regionDisplayName, REGION_NAMES } from "@/lib/regions";
import { getScoreDisplay } from "@/lib/scoring-display";
import type { Venue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ region: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const name = regionDisplayName(region);
  const title = `${name} Coffee Rankings — Coffeesnob`;
  const description = `The highest-ranked specialty coffee shops in ${name}, based on weighted reviewer scores.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Coffeesnob",
    },
  };
}

export default async function RegionRankingsPage({ params }: Props) {
  const { region: regionSlug } = await params;

  const supabase = await createClient();

  const [
    { data: { user } },
    { data: cityRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("venues").select("city").order("city", { ascending: true }),
  ]);

  const regions = buildRegionFilterOptions(
    (cityRows ?? []).map((r) => r.city),
  );
  const regionData = regions.find((r) => r.id === regionSlug);

  // Invalid region slug → 404. Only accept slugs that match actual DB data or
  // known REGION_NAMES so we don't serve empty pages for typos.
  if (!regionData && !(regionSlug in REGION_NAMES)) {
    notFound();
  }

  const regionName = regionDisplayName(regionSlug);

  // If slug is known but no venues exist yet, render an empty state rather than 404.
  let venues: Venue[] = [];
  if (regionData) {
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .in("city", regionData.cities)
      .order("name", { ascending: true });

    if (error) {
      return (
        <>
          <SiteHeader />
          <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
            <BackLink />
            <h1 className="mt-4 text-2xl font-semibold">
              {regionName} Coffee Rankings
            </h1>
            <p className="mt-4 text-sm text-[var(--color-destructive)]">
              {error.message}
            </p>
          </main>
        </>
      );
    }
    venues = (data ?? []) as Venue[];
  }

  const weightedScores =
    venues.length > 0
      ? await getVenueOverallScores(
          supabase,
          venues.map((v) => v.id),
        )
      : new Map();

  const { ranked, unranked } = buildRankings(venues, weightedScores);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <BackLink />

        <div className="mb-8 mt-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {regionName} Coffee Rankings
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            The highest-ranked specialty coffee shops in {regionName}, based on
            weighted reviewer scores.
          </p>
        </div>

        {ranked.length === 0 && unranked.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No venues in {regionName} yet.
          </p>
        ) : null}

        {ranked.length > 0 ? (
          <section aria-label="Ranked venues">
            <ul className="grid gap-4">
              {ranked.map(({ venue: v, rank, score, reviewCount }) => {
                const display = getScoreDisplay(score, true);
                return (
                  <li key={v.id}>
                    <Link href={`/venues/${v.slug}`} className="block">
                      <Card className="transition-colors hover:bg-[var(--color-muted)]">
                        <CardHeader className="p-4 sm:p-6">
                          <div className="flex items-baseline gap-4">
                            <span
                              className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]"
                              aria-label={`Rank ${rank}`}
                            >
                              #{rank}
                            </span>
                            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-4">
                              <CardTitle className="truncate">{v.name}</CardTitle>
                              <div className="shrink-0 text-right text-sm">
                                <div className="font-medium">
                                  {display.formattedScore}
                                </div>
                                <div className="text-xs text-[var(--color-muted-foreground)]">
                                  {reviewCount} review
                                  {reviewCount === 1 ? "" : "s"}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="pl-8">
                            <CardDescription>
                              {v.city} · {v.postcode}
                            </CardDescription>
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {unranked.length > 0 ? (
          <section aria-label="Unranked venues" className="mt-12">
            <h2 className="mb-4 text-base font-semibold tracking-tight text-[var(--color-muted-foreground)]">
              Unranked venues
            </h2>
            <ul className="grid gap-3">
              {unranked.map(({ venue: v, reviewCount }) => {
                const reviewCta = user
                  ? `/venues/${v.slug}/review`
                  : `/venues/${v.slug}`;
                return (
                  <li key={v.id}>
                    <Card className="opacity-70">
                      <CardHeader className="p-4 sm:p-6">
                        <div className="flex items-baseline justify-between gap-4">
                          <div>
                            <div className="mb-0.5 text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                              Unranked
                            </div>
                            <CardTitle>
                              <Link
                                href={`/venues/${v.slug}`}
                                className="hover:underline"
                              >
                                {v.name}
                              </Link>
                            </CardTitle>
                          </div>
                          <div className="shrink-0 text-right text-sm text-[var(--color-muted-foreground)]">
                            {reviewCount} review
                            {reviewCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <CardDescription>
                          {v.city} · {v.postcode}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between gap-4 px-4 pb-4 text-sm sm:px-6 sm:pb-6">
                        <p className="text-[var(--color-muted-foreground)]">
                          {reviewCount === 0
                            ? "No reviews yet."
                            : "Needs more trusted reviews to enter the rankings."}
                        </p>
                        <Link
                          href={reviewCta}
                          className="shrink-0 text-sm font-medium underline-offset-2 hover:underline"
                        >
                          Review it
                        </Link>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/rankings"
      className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
    >
      ← All Rankings
    </Link>
  );
}
