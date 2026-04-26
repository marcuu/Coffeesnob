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
import { BackLink } from "./BackLink";

import { deleteReview } from "./actions";
import { ScoreExplain } from "./score-explain";

export const dynamic = "force-dynamic";

type ReviewWithReviewer = Review & {
  reviewer: { display_name: string; review_count: number; username: string | null } | null;
};

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

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

  const regionId = regionIdFromCityName(venueRow.city);
  const scopeLabel = regionDisplayName(regionId);
  const regionVenueIds = (allVenueRows ?? [])
    .filter((r) => regionIdFromCityName(r.city) === regionId)
    .map((r) => r.id);

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
      .select("*, reviewer:reviewers(display_name, review_count, username)")
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

  const MONO_LABEL: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "var(--color-muted-foreground)",
  };

  return (
    <>
      <SiteHeader />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "clamp(24px,5vw,40px) clamp(16px,4vw,36px) 120px" }}>

        {/* Back → regional rankings */}
        <BackLink href={`/rankings/${regionId}`} label={`${scopeLabel} Rankings`} />

        {/* Venue name + score + ⓘ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "start", marginBottom: 24 }}>
          <div>
            <div style={{ ...MONO_LABEL, marginBottom: 14 }}>Venue</div>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
              <span style={{ ...MONO_LABEL, letterSpacing: "0.18em" }}>/ 10.0 overall</span>
              {explain ? <ScoreExplain data={explain} /> : null}
            </div>
            <div style={{ ...MONO_LABEL, letterSpacing: "0.14em", marginTop: 10 }}>
              Coffee {formatRating(coffeeScore)} · Experience {formatRating(experienceScore)}
            </div>
            <div style={{ ...MONO_LABEL, letterSpacing: "0.12em", marginTop: 6 }}>
              {count} review{count === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {/* Rank metadata */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 24 }}>
          {rankingSummary.isUnranked ? (
            <>
              <span style={{ ...MONO_LABEL, letterSpacing: "0.14em" }}>Unranked</span>
              <SignalBadge label={rankingSummary.signalLabel} />
            </>
          ) : (
            <>
              {rankingSummary.rank !== null ? (
                <RankingBadge rank={rankingSummary.rank} scopeLabel={rankingSummary.scopeLabel} href={`/rankings/${regionId}`} />
              ) : null}
              <ScoreBandBadge label={rankingSummary.scoreLabel} tone={rankingSummary.scoreTone} />
              <SignalBadge label={rankingSummary.signalLabel} />
            </>
          )}
        </div>

        {/* Chips */}
        {venueRow.roasters.length || venueRow.brew_methods.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
            {venueRow.roasters.map((r) => (
              <span key={`r-${r}`} style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", border: "1px solid var(--color-border)", borderRadius: 2, color: "var(--color-muted-foreground)" }}>
                {r}
              </span>
            ))}
            {venueRow.brew_methods.map((b) => (
              <span key={`b-${b}`} style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", background: "var(--color-muted)", borderRadius: 2, color: "var(--color-muted-foreground)" }}>
                {b.replace("_", " ")}
              </span>
            ))}
          </div>
        ) : null}

        {/* Notes */}
        {venueRow.notes ? (
          <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--color-muted-foreground)", maxWidth: 580, marginBottom: 24, whiteSpace: "pre-line" }}>
            {venueRow.notes}
          </p>
        ) : null}

        <div style={{ height: 1, background: "var(--color-border)", marginBottom: 40 }} />

        {/* Reviews */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ ...MONO_LABEL, marginBottom: 24 }}>
            Reviews · {count}
          </div>
          {reviews.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--color-muted-foreground)" }}>No reviews yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 1 }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: "24px 0", borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    {r.reviewer?.username ? (
                      <Link
                        href={`/profile/${r.reviewer.username}`}
                        className="hover:underline"
                        style={{ fontWeight: 600, fontSize: 15, color: "var(--color-foreground)", textDecoration: "none" }}
                      >
                        {r.reviewer.display_name}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {r.reviewer?.display_name ?? "Unknown reviewer"}
                      </span>
                    )}
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

        {/* Add review CTA — no section header */}
        {user ? (
          <Link
            href={`/venues/${slug}/review`}
            style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 42, padding: "0 24px", background: "hsl(20 14.3% 6%)", color: "hsl(60 9.1% 97.8%)", border: "none", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}
          >
            Add review →
          </Link>
        ) : (
          <p style={{ fontSize: 13, color: "var(--color-muted-foreground)" }}>
            <Link href="/login" style={{ color: "var(--color-foreground)", textDecoration: "underline" }}>Sign in</Link> to leave a review.
          </p>
        )}

      </main>
    </>
  );
}
