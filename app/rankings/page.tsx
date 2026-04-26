import type { Metadata } from "next";
import Link from "next/link";

import { RegionPicker } from "@/components/RegionPicker";
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
import { getScoreDisplay } from "@/lib/scoring-display";
import { buildRegionFilterOptions } from "@/lib/venues";
import type { Venue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coffeesnob Rankings — Top UK Specialty Coffee",
  description:
    "The top UK specialty coffee shops, ranked by weighted reviewer scores.",
  openGraph: {
    title: "Coffeesnob Rankings — Top UK Specialty Coffee",
    description:
      "The top UK specialty coffee shops, ranked by weighted reviewer scores.",
    type: "website",
    siteName: "Coffeesnob",
  },
};

export default async function RankingsPage() {
  const supabase = await createClient();

  const [
    { data: { user } },
    { data, error },
    { data: cityRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("venues").select("*").order("name", { ascending: true }),
    supabase.from("venues").select("city").order("city", { ascending: true }),
  ]);

  if (error) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="text-2xl font-semibold">Rankings</h1>
          <p className="mt-4 text-sm text-[var(--color-destructive)]">
            {error.message}
          </p>
        </main>
      </>
    );
  }

  const venues = (data ?? []) as Venue[];
  const activeRegions = buildRegionFilterOptions(
    (cityRows ?? []).map((r) => r.city),
  );
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
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Coffeesnob Rankings
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              The top UK specialty coffee shops.
            </p>
          </div>
          <RegionPicker regions={activeRegions} />
        </div>

        {ranked.length === 0 && unranked.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No venues yet.
          </p>
        ) : null}

        {ranked.length > 0 ? (
          <section aria-label="Ranked venues">
            <ul className="grid gap-4">
              {ranked.map(({ venue: v, rank, score, reviewCount }) => {
                const display = getScoreDisplay(score, true);
                const isPrimary = rank === 1 && !!v.photo_url;

                if (isPrimary) {
                  return (
                    <li key={v.id}>
                      <Link href={`/venues/${v.slug}`} className="group block">
                        <div className="rankings-hero">
                          <div className="rankings-hero-img">
                            <img
                              src={v.photo_url!}
                              alt={v.name}
                              style={{
                                width: "100%", height: "100%",
                                objectFit: "cover", objectPosition: "center",
                                filter: "grayscale(10%) brightness(0.78) contrast(1.1) saturate(0.85)",
                                display: "block",
                                transition: "transform 600ms cubic-bezier(.2,.7,.2,1)",
                              }}
                              className="group-hover:scale-[1.03]"
                            />
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 60%, hsl(20 14.3% 6%) 100%)" }} />
                          </div>
                          <div className="rankings-hero-content">
                            <div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "oklch(0.52 0.11 44)", marginBottom: 20 }}>
                                No. 1 in the UK
                              </div>
                              <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.1, color: "hsl(60 9.1% 97.8%)" }}>
                                {v.name}
                              </div>
                              <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "hsl(24 5.4% 50%)" }}>
                                {v.city} · {v.postcode} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
                              </div>
                            </div>
                            <div style={{ marginTop: 32 }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "hsl(24 5.4% 38%)", marginBottom: 4 }}>Score</div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 48, fontWeight: 400, color: "oklch(0.52 0.11 44)", lineHeight: 1, letterSpacing: "-0.02em" }}>
                                {display.formattedScore}
                                <span style={{ fontSize: 16, color: "hsl(24 5.4% 38%)", marginLeft: 4 }}>/10</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                }

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
