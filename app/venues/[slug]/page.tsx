import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { RankingBadge } from "@/components/ranking/RankingBadge";
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
import { SyntheticBadge } from "@/components/simulation/SyntheticBadge";
import { ShareButton } from "@/components/share-button";
import { WishlistButton } from "@/components/wishlist-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("name, city, notes")
    .eq("slug", slug)
    .maybeSingle();
  if (!venue) return { title: "Caffiends" };

  const title = `${venue.name}, ${venue.city} — Caffiends`;
  const description =
    venue.notes ??
    `${venue.name} in ${venue.city}: weighted community score, reviews, and UK coffee ranking on Caffiends.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Caffiends" },
  };
}

type ReviewWithReviewer = Review & {
  reviewer: { display_name: string; review_count: number; username: string | null; is_synthetic: boolean } | null;
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
      .select("*, reviewer:reviewers(display_name, review_count, username, is_synthetic)")
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
  const vibeScore = weightedScores?.displayable
    ? (weightedScores.axes.vibe?.score ?? null)
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
  const hasReviewed = user
    ? reviews.some((r) => r.reviewer_id === user.id)
    : false;

  let inWishlist = false;
  if (user && !hasReviewed) {
    const { data: wishlistRow } = await supabase
      .from("review_wishlist")
      .select("venue_id")
      .eq("reviewer_id", user.id)
      .eq("venue_id", venueRow.id)
      .maybeSingle();
    inWishlist = !!wishlistRow;
  }

  const MONO_LABEL: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--color-muted-foreground)",
  };

  const IMG_FILTER = "grayscale(10%) brightness(0.78) contrast(1.1) saturate(0.85)";

  // Structured data for search engines — venue + community rating.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: venueRow.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: [venueRow.address_line1, venueRow.address_line2]
        .filter(Boolean)
        .join(", "),
      addressLocality: venueRow.city,
      postalCode: venueRow.postcode,
      addressCountry: venueRow.country ?? "GB",
    },
    ...(venueRow.latitude != null && venueRow.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: venueRow.latitude,
            longitude: venueRow.longitude,
          },
        }
      : {}),
    ...(displayScore !== null && count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(displayScore.toFixed(1)),
            bestRating: 10,
            worstRating: 1,
            reviewCount: count,
          },
        }
      : {}),
    ...(venueRow.website ? { url: venueRow.website } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      {/* Full-bleed hero banner — only shown when the venue has a photo */}
      {venueRow.photo_url && (
        <div style={{ width: "100%", height: "clamp(220px, 50vw, 380px)", overflow: "hidden", position: "relative" }}>
          <img
            src={venueRow.photo_url}
            alt={venueRow.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", filter: IMG_FILTER, display: "block" }}
          />
          {/* Dark gradient scrim so the venue name is always legible */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 180, background: "linear-gradient(to bottom, transparent, rgba(8,5,3,0.82))" }} />
          {/* Page-background fade at the very bottom to blend into content */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, var(--color-background))" }} />
          <div style={{ position: "absolute", bottom: 24, left: "clamp(16px,4vw,36px)", right: "clamp(16px,4vw,36px)", fontFamily: "var(--font-serif)", fontSize: "clamp(26px,6vw,38px)", fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.1, color: "hsl(60 9.1% 97%)" }}>
            {venueRow.name}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 920, margin: "0 auto", padding: venueRow.photo_url ? "24px clamp(16px,4vw,36px) clamp(64px,10vw,120px)" : "clamp(24px,5vw,40px) clamp(16px,4vw,36px) clamp(64px,10vw,120px)" }}>

        {/* Venue name + score + ⓘ */}
        <div className="venue-head" style={{ marginBottom: 24, marginTop: venueRow.photo_url ? 16 : 0 }}>
          <div>
            {/* Only show the title block here when there's no hero banner */}
            {!venueRow.photo_url && (
              <>
                <div style={{ ...MONO_LABEL, marginBottom: 14 }}>Venue</div>
                <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "clamp(28px,4vw,44px)", fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
                  {venueRow.name}
                </h1>
              </>
            )}
            <div style={{ marginTop: venueRow.photo_url ? 0 : 10, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--color-muted-foreground)" }}>
              {[
                [venueRow.address_line1, venueRow.address_line2]
                  .filter(Boolean)
                  .join(", "),
                `${venueRow.city} ${venueRow.postcode}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div style={{ textAlign: "right", paddingTop: venueRow.photo_url ? 0 : 24 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "clamp(40px, 9vw, 56px)", fontWeight: 400, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--color-accent)" }}>
              {formatRating(displayScore)}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
              {explain ? <ScoreExplain data={explain} /> : null}
            </div>
            <div style={{ ...MONO_LABEL, letterSpacing: "0.14em", marginTop: 10, textAlign: "right" }}>
              <div>Coffee {formatRating(coffeeScore)}</div>
              <div style={{ marginTop: 4 }}>Vibe {formatRating(vibeScore)}</div>
            </div>
          </div>
        </div>

        {/* One primary action; everything else is a quiet icon. */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 24 }}>
          {user && !alreadyReviewedToday ? (
            <Link
              href={`/venues/${slug}/review`}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 48, padding: "0 28px", background: "var(--color-accent)", color: "hsl(20 14.3% 4%)", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none", fontWeight: 500 }}
            >
              Add review →
            </Link>
          ) : null}
          {user && !hasReviewed ? (
            <WishlistButton venueId={venueRow.id} initialInWishlist={inWishlist} compact />
          ) : null}
          <ShareButton
            title={`${venueRow.name} — Caffiends`}
            text={
              displayScore !== null
                ? `${venueRow.name} scores ${formatRating(displayScore)}/10 on Caffiends.`
                : `${venueRow.name} on Caffiends.`
            }
            path={`/venues/${slug}`}
            compact
          />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              venueRow.latitude != null && venueRow.longitude != null
                ? `${venueRow.latitude},${venueRow.longitude}`
                : `${venueRow.name} ${venueRow.postcode}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in Maps"
            title="Open in Maps"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, minHeight: 44, border: "1px solid var(--color-border)", borderRadius: 2, color: "var(--color-muted-foreground)", textDecoration: "none" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </a>
        </div>

        {/* One rank statement. The ⓘ next to the score explains the rest. */}
        <div style={{ marginBottom: 24 }}>
          {!rankingSummary.isUnranked && rankingSummary.rank !== null ? (
            <RankingBadge rank={rankingSummary.rank} scopeLabel={rankingSummary.scopeLabel} />
          ) : (
            <span style={{ ...MONO_LABEL, letterSpacing: "0.14em" }}>
              Not yet ranked · {count} review{count === 1 ? "" : "s"}
            </span>
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

        {/* Quiet edit affordance for the venue's creator. */}
        {user?.id === venueRow.created_by ? (
          <div style={{ marginBottom: 24 }}>
            <Link
              href={`/venues/${slug}/edit`}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted-foreground)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Add details
            </Link>
          </div>
        ) : null}

        <div style={{ height: 1, background: "var(--color-border)", marginBottom: 40 }} />

        {/* Reviews */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ ...MONO_LABEL, marginBottom: 24 }}>
            Reviews · {count}
          </div>
          {reviews.some((r) => r.is_synthetic) && (
            <p style={{ fontSize: 13, color: "var(--color-muted-foreground)", marginBottom: 16 }}>
              Some reviews on this page are from Caffiends&apos; calibration panel.{" "}
              <Link href="/about/calibration" style={{ textDecoration: "underline" }}>
                Learn more →
              </Link>
            </p>
          )}
          {reviews.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--color-muted-foreground)" }}>No reviews yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 1 }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: "24px 0", borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                      {r.reviewer?.is_synthetic && <SyntheticBadge />}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 400, letterSpacing: "-0.01em" }}>
                      {r.rating_overall}/10
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 14 }}>
                    Visited {r.visited_on}
                    {r.reviewer ? ` · ${r.reviewer.review_count} review${r.reviewer.review_count === 1 ? "" : "s"}` : ""}
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.75, marginBottom: 16, whiteSpace: "pre-line" }}>{r.body}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                    {[
                      ["Coffee", r.rating_coffee_5],
                      ["Vibe", r.rating_vibe_5],
                    ].map(([label, val]) => (
                      <span key={label as string} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>
                        {label} <strong style={{ color: "var(--color-foreground)", fontWeight: 600 }}>{val}/5</strong>
                      </span>
                    ))}
                  </div>
                  {user?.id === r.reviewer_id ? (
                    <form action={deleteReview} style={{ marginTop: 12 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button
                        type="submit"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-destructive)", background: "none", border: "none", cursor: "pointer", padding: "12px 0", minHeight: 44 }}
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
            style={{ display: "inline-flex", alignItems: "center", gap: 12, minHeight: 48, padding: "0 28px", background: "hsl(20 14.3% 6%)", color: "hsl(60 9.1% 97.8%)", border: "1px solid var(--color-border)", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", textDecoration: "none" }}
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
