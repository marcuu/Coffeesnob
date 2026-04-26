import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { RankingBadge } from "@/components/ranking/RankingBadge";
import { ScoreBandBadge } from "@/components/ranking/ScoreBandBadge";
import { SignalBadge } from "@/components/ranking/SignalBadge";
import { createClient } from "@/utils/supabase/server";
import type { Review, Venue } from "@/lib/types";
import { formatRating } from "@/lib/venues";
import {
  explainVenueScore,
  getVenueOverallScores,
  getVenueScores,
} from "@/lib/aggregation";
import {
  buildVenueRankingSummary,
  computeRank,
} from "@/lib/ranking-context";
import { regionDisplayName, regionIdFromCityName } from "@/lib/regions";

import { deleteReview } from "./actions";
import { ScoreExplain } from "./score-explain";

export const dynamic = "force-dynamic";

type ReviewWithReviewer = Review & {
  reviewer: { display_name: string; review_count: number } | null;
};

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Round 1: venue + all venue id/city rows (neither depends on the other).
  const [
    { data: venue, error: venueError },
    { data: allVenueRows },
  ] = await Promise.all([
    supabase.from("venues").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("venues").select("id, city"),
  ]);

  if (venueError) throw venueError;
  if (!venue) notFound();

  const venueRow = venue as Venue;

  // Compute region for rank scope.
  const regionId = regionIdFromCityName(venueRow.city);
  const scopeLabel = regionDisplayName(regionId);
  const regionVenueIds = (allVenueRows ?? [])
    .filter((r) => regionIdFromCityName(r.city) === regionId)
    .map((r) => r.id);

  // Round 2: reviews + per-axis scores + region overall scores + auth (parallel).
  const [
    { data: reviewsData, error: reviewsError },
    weightedScores,
    regionalScores,
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("reviews")
      .select("*, reviewer:reviewers(display_name, review_count)")
      .eq("venue_id", venueRow.id)
      .order("created_at", { ascending: false }),
    getVenueScores(supabase, venueRow.id),
    getVenueOverallScores(supabase, regionVenueIds),
    supabase.auth.getUser(),
  ]);

  if (reviewsError) throw reviewsError;

  const reviews = (reviewsData ?? []) as ReviewWithReviewer[];
  const count = reviews.length;

  const displayScore = weightedScores?.displayable
    ? (weightedScores.axes.overall?.score ?? null)
    : null;
  const coffeeScore = weightedScores?.displayable
    ? (weightedScores.axes.coffee?.score ?? null)
    : null;
  const experienceScore = weightedScores?.displayable
    ? (weightedScores.axes.experience?.score ?? null)
    : null;

  const explain =
    weightedScores?.displayable
      ? await explainVenueScore(supabase, venueRow.id, "overall")
      : null;

  // Build ranking context using region-scoped data.
  const rank = computeRank(venueRow.id, regionalScores);
  const rankingSummary = buildVenueRankingSummary(
    venueRow.id,
    regionalScores.get(venueRow.id),
    rank,
    scopeLabel,
  );

  const alreadyReviewedToday = user
    ? reviews.some(
        (r) =>
          r.reviewer_id === user.id &&
          r.visited_on === new Date().toISOString().slice(0, 10),
      )
    : false;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/venues"
        className="text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        ← Back to venues
      </Link>

      <div className="mt-3 flex items-baseline justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {venueRow.name}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {venueRow.address_line1}
            {venueRow.address_line2 ? `, ${venueRow.address_line2}` : ""} ·{" "}
            {venueRow.city} {venueRow.postcode}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">{formatRating(displayScore)}</div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            {count} review{count === 1 ? "" : "s"}
          </div>
          <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Coffee {formatRating(coffeeScore)} · Experience {formatRating(experienceScore)}
          </div>
        </div>
      </div>

      {/* Ranking context hero */}
      <div className="mt-4 space-y-1.5">
        {rankingSummary.isUnranked ? (
          <>
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <span className="font-medium">Unranked</span>
              <span>·</span>
              <SignalBadge label={rankingSummary.signalLabel} />
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {rankingSummary.reviewPrompt}{" "}
              <Link
                href={`/venues/${slug}/review`}
                className="font-medium underline-offset-2 hover:underline"
              >
                Help this venue enter the rankings.
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {rankingSummary.rank !== null ? (
                <RankingBadge
                  rank={rankingSummary.rank}
                  scopeLabel={rankingSummary.scopeLabel}
                />
              ) : null}
              <ScoreBandBadge
                label={rankingSummary.scoreLabel}
                tone={rankingSummary.scoreTone}
              />
              <SignalBadge label={rankingSummary.signalLabel} />
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {rankingSummary.reviewPrompt}{" "}
              <Link
                href={`/venues/${slug}/review`}
                className="font-medium underline-offset-2 hover:underline"
              >
                Add your review.
              </Link>
            </p>
          </>
        )}
        <div>
          <Link
            href={`/rankings/${regionId}`}
            className="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:underline"
          >
            ← {scopeLabel} Rankings
          </Link>
        </div>
      </div>

      {venueRow.roasters.length || venueRow.brew_methods.length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]">
          {venueRow.roasters.map((r) => (
            <span
              key={`r-${r}`}
              className="rounded-full border border-[var(--color-border)] px-2 py-0.5"
            >
              {r}
            </span>
          ))}
          {venueRow.brew_methods.map((b) => (
            <span
              key={`b-${b}`}
              className="rounded-full bg-[var(--color-muted)] px-2 py-0.5"
            >
              {b.replace("_", " ")}
            </span>
          ))}
        </div>
      ) : null}

      {explain ? <ScoreExplain data={explain} /> : null}

      {venueRow.notes ? (
        <p className="mt-6 whitespace-pre-line text-sm">{venueRow.notes}</p>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            No reviews yet.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-baseline justify-between gap-4">
                      <CardTitle className="text-base">
                        {r.reviewer?.display_name ?? "Unknown reviewer"}
                      </CardTitle>
                      <div className="text-sm font-medium">
                        {r.rating_overall}/10 overall
                      </div>
                    </div>
                    <CardDescription>
                      Visited {r.visited_on}
                      {r.reviewer
                        ? ` · ${r.reviewer.review_count} review${r.reviewer.review_count === 1 ? "" : "s"}`
                        : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-line text-sm">{r.body}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
                      <span>Taste {r.rating_taste ?? "—"}</span>
                      <span>Body {r.rating_body ?? "—"}</span>
                      <span>Aroma {r.rating_aroma ?? "—"}</span>
                      <span>Ambience {r.rating_ambience}</span>
                      <span>Service {r.rating_service}</span>
                      <span>Value {r.rating_value}</span>
                    </div>
                    {user?.id === r.reviewer_id ? (
                      <form action={deleteReview}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="slug" value={slug} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-[var(--color-destructive)]"
                        >
                          Delete
                        </Button>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Add a review</h2>
        {alreadyReviewedToday ? (
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            You already logged a visit for today. Edit the date to record a
            different visit.
          </p>
        ) : null}
        <div className="mt-4">
          <Button asChild>
            <Link href={`/venues/${slug}/review`}>Start 6-step review</Link>
          </Button>
        </div>
      </section>
      </main>
    </>
  );
}
