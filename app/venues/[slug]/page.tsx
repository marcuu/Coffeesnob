import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { RankingBadge } from "@/components/ranking/RankingBadge";
import { ScoreBandBadge } from "@/components/ranking/ScoreBandBadge";
import { SignalBadge } from "@/components/ranking/SignalBadge";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import type { Review, Venue } from "@/lib/types";
import { formatRating } from "@/lib/venues";
import { explainVenueScore, getVenueOverallScores, getVenueScores } from "@/lib/aggregation";
import { buildVenueRankingSummary, computeRank } from "@/lib/ranking-context";
import { regionDisplayName, regionIdFromCityName } from "@/lib/regions";
import { deleteReview } from "./actions";
import { ScoreExplain } from "./score-explain";

export const dynamic = "force-dynamic";

type ReviewWithReviewer = Review & {
  reviewer: { display_name: string; review_count: number; username: string | null; is_synthetic?: boolean } | null;
};

export default async function VenueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const [{ data: venue, error: venueError }, { data: allVenueRows }, { data: auth }] = await Promise.all([
    supabase.from("venues").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("venues").select("id, city, is_fictional"),
    supabase.auth.getUser(),
  ]);

  if (venueError) throw venueError;
  if (!venue) notFound();

  const venueRow = venue as Venue;
  const user = auth.user;
  if (!user && !venueRow.is_fictional) redirect("/login");

  const readClient = venueRow.is_fictional ? createServiceRoleClient() : supabase;
  const regionId = regionIdFromCityName(venueRow.city);
  const scopeLabel = venueRow.is_fictional ? "Bramford" : regionDisplayName(regionId);
  const regionVenueIds = (allVenueRows ?? [])
    .filter((r) => regionIdFromCityName(r.city) === regionId && Boolean(r.is_fictional) === venueRow.is_fictional)
    .map((r) => r.id);

  const [{ data: reviewsData, error: reviewsError }, weightedScores, regionalScores] = await Promise.all([
    readClient
      .from("reviews")
      .select("*, reviewer:reviewers(display_name, review_count, username, is_synthetic)")
      .eq("venue_id", venueRow.id)
      .order("created_at", { ascending: false }),
    getVenueScores(supabase, venueRow.id),
    getVenueOverallScores(supabase, regionVenueIds),
  ]);
  if (reviewsError) throw reviewsError;

  const reviews = (reviewsData ?? []) as ReviewWithReviewer[];
  const count = reviews.length;
  const displayScore = weightedScores?.displayable ? (weightedScores.axes.overall?.score ?? null) : null;
  const coffeeScore = weightedScores?.displayable ? (weightedScores.axes.coffee?.score ?? null) : null;
  const vibeScore = weightedScores?.displayable ? (weightedScores.axes.vibe?.score ?? null) : null;
  const explain = weightedScores?.displayable ? await explainVenueScore(readClient, venueRow.id, "overall") : null;
  const rank = computeRank(venueRow.id, regionalScores);
  const rankingSummary = buildVenueRankingSummary(venueRow.id, regionalScores.get(venueRow.id), rank, scopeLabel);

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "start", marginBottom: 24 }}>
          <div>
            <div style={{ ...MONO_LABEL, marginBottom: 14 }}>{venueRow.is_fictional ? "Bramford venue" : "Venue"}</div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "clamp(28px,4vw,44px)", fontWeight: 400, lineHeight: 1.05 }}>{venueRow.name}</h1>
            <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--color-muted-foreground)" }}>
              {venueRow.address_line1}{venueRow.address_line2 ? `, ${venueRow.address_line2}` : ""} - {venueRow.city} {venueRow.postcode}
            </div>
          </div>
          <div style={{ textAlign: "right", paddingTop: 24 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 56, lineHeight: 1, color: "var(--color-accent)" }}>{formatRating(displayScore)}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>{explain ? <ScoreExplain data={explain} /> : null}</div>
            <div style={{ ...MONO_LABEL, letterSpacing: "0.14em", marginTop: 10, textAlign: "right" }}>
              <div>Coffee {formatRating(coffeeScore)}</div>
              <div style={{ marginTop: 4 }}>Vibe {formatRating(vibeScore)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 24 }}>
          {rankingSummary.isUnranked ? (
            <><span style={{ ...MONO_LABEL, letterSpacing: "0.14em" }}>Unranked</span><SignalBadge label={rankingSummary.signalLabel} /></>
          ) : (
            <><RankingBadge rank={rankingSummary.rank} scopeLabel={rankingSummary.scopeLabel} /><ScoreBandBadge label={rankingSummary.scoreLabel} tone={rankingSummary.scoreTone} /><SignalBadge label={rankingSummary.signalLabel} /></>
          )}
        </div>

        {venueRow.notes ? <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--color-muted-foreground)", maxWidth: 620, marginBottom: 24, whiteSpace: "pre-line" }}>{venueRow.notes}</p> : null}

        {venueRow.is_fictional ? (
          <div style={{ border: "1px solid var(--color-border)", padding: 14, margin: "8px 0 32px", fontSize: 13, color: "var(--color-muted-foreground)", lineHeight: 1.6 }}>
            Some reviews on this page are from Coffeesnob's calibration panel. <Link href="/about/calibration" style={{ color: "var(--color-foreground)", textDecoration: "underline" }}>Learn more</Link>.
          </div>
        ) : null}

        <div style={{ height: 1, background: "var(--color-border)", marginBottom: 40 }} />

        <section style={{ marginBottom: 48 }}>
          <div style={{ ...MONO_LABEL, marginBottom: 24 }}>Reviews - {count}</div>
          {reviews.length === 0 ? <p style={{ fontSize: 14, color: "var(--color-muted-foreground)" }}>No reviews yet.</p> : (
            <div style={{ display: "grid", gap: 1 }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: "24px 0", borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    {r.reviewer?.username ? (
                      <Link href={`/profile/${r.reviewer.username}`} style={{ fontWeight: 600, fontSize: 15, color: "var(--color-foreground)", textDecoration: "none" }}>{r.reviewer.display_name}</Link>
                    ) : <span style={{ fontWeight: 600, fontSize: 15 }}>{r.reviewer?.display_name ?? "Unknown reviewer"}</span>}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 18 }}>{r.rating_overall}/10</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 14 }}>
                    Visited {r.visited_on}{r.reviewer ? ` - ${r.reviewer.review_count} review${r.reviewer.review_count === 1 ? "" : "s"}` : ""}
                    {r.reviewer?.is_synthetic ? " - Calibration reviewer" : ""}
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 16, whiteSpace: "pre-line" }}>{r.body}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>Coffee <strong style={{ color: "var(--color-foreground)", fontWeight: 600 }}>{r.rating_coffee_5}/5</strong></span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>Vibe <strong style={{ color: "var(--color-foreground)", fontWeight: 600 }}>{r.rating_vibe_5}/5</strong></span>
                  </div>
                  {user?.id === r.reviewer_id ? (
                    <form action={deleteReview} style={{ marginTop: 12 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button type="submit" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-destructive)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Delete</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {!venueRow.is_fictional && user ? (
          <Link href={`/venues/${slug}/review`} style={{ display: "inline-flex", alignItems: "center", height: 42, padding: "0 24px", background: "hsl(20 14.3% 6%)", color: "hsl(60 9.1% 97.8%)", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>Add review</Link>
        ) : !venueRow.is_fictional ? (
          <p style={{ fontSize: 13, color: "var(--color-muted-foreground)" }}><Link href="/login" style={{ color: "var(--color-foreground)", textDecoration: "underline" }}>Sign in</Link> to leave a review.</p>
        ) : null}
      </main>
    </>
  );
}
