import Link from "next/link";
import { notFound } from "next/navigation";

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
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "40px 36px 120px" }}>
      <Link
        href="/venues"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-muted-foreground)",
          textDecoration: "none",
          display: "block",
          marginBottom: 48,
        }}
      >
        ← Back to venues
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "start", marginBottom: 32 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 14 }}>Venue</div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "clamp(28px,4vw,44px)", fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
            {venueRow.name}
          </h1>
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--color-muted-foreground)" }}>
            {venueRow.address_line1}
            {venueRow.address_line2 ? `, ${venueRow.address_line2}` : ""} ·{" "}
            {venueRow.city} {venueRow.postcode}
          </div>
        </div>
        <div style={{ textAlign: "right", paddingTop: 24 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 56, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--color-accent)" }}>
            {formatRating(displayScore)}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginTop: 4 }}>
            / 10.0 overall
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginTop: 10 }}>
            Coffee {formatRating(coffeeScore)} · Experience {formatRating(experienceScore)}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginTop: 6 }}>
            {count} review{count === 1 ? "" : "s"}
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 32 }}>
          {venueRow.roasters.map((r) => (
            <span
              key={`r-${r}`}
              style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", border: "1px solid var(--color-border)", borderRadius: 2, color: "var(--color-muted-foreground)" }}
            >
              {r}
            </span>
          ))}
          {venueRow.brew_methods.map((b) => (
            <span
              key={`b-${b}`}
              style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", background: "var(--color-muted)", borderRadius: 2, color: "var(--color-muted-foreground)" }}
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

      <div style={{ height: 1, background: "var(--color-border)", marginBottom: 32 }} />

      <section style={{ marginBottom: 56 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 24 }}>
          Reviews · {count}
        </div>
        {reviews.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--color-muted-foreground)" }}>No reviews yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 1 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ padding: "24px 0", borderBottom: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>
                    {r.reviewer?.display_name ?? "Unknown reviewer"}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 400, letterSpacing: "-0.01em" }}>
                    {r.rating_overall}/10
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 14 }}>
                  Visited {r.visited_on}
                  {r.reviewer ? ` · ${r.reviewer.review_count} review${r.reviewer.review_count === 1 ? "" : "s"}` : ""}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 16, whiteSpace: "pre-line" }}>{r.body}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                  {[
                    ["Taste", r.rating_taste],
                    ["Body", r.rating_body],
                    ["Aroma", r.rating_aroma],
                    ["Ambience", r.rating_ambience],
                    ["Service", r.rating_service],
                    ["Value", r.rating_value],
                  ].map(([label, val]) => (
                    <span key={label as string} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>
                      {label} <strong style={{ color: "var(--color-foreground)", fontWeight: 600 }}>{val ?? "—"}</strong>
                    </span>
                  ))}
                </div>
                {user?.id === r.reviewer_id ? (
                  <form action={deleteReview} style={{ marginTop: 12 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <button
                      type="submit"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-destructive)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 20 }}>
          Add a review
        </div>
        {alreadyReviewedToday ? (
          <p style={{ fontSize: 13, color: "var(--color-muted-foreground)", marginBottom: 16 }}>
            You already logged a visit for today. Edit the date to record a different visit.
          </p>
        ) : null}
        {user ? (
          <Link
            href={`/venues/${slug}/review`}
            style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 42, padding: "0 24px", background: "hsl(20 14.3% 6%)", color: "hsl(60 9.1% 97.8%)", border: "none", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}
          >
            Start 6-step review →
          </Link>
        ) : (
          <p style={{ fontSize: 13, color: "var(--color-muted-foreground)" }}>
            <Link href="/login" style={{ color: "var(--color-foreground)", textDecoration: "underline" }}>Sign in</Link> to leave a review.
          </p>
        )}
      </section>
      </main>
    </>
  );
}
