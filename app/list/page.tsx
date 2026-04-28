import Link from "next/link";
import { redirect } from "next/navigation";

import { RankedList, type RankedItem } from "@/components/list/ranked-list";
import { SiteHeader } from "@/components/site-header";
import type { Review, ReviewBucket, Reviewer } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

export default async function MyListPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select(
      "id, display_name, username, seen_ranking_onboarding_at, review_count",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (
    reviewer &&
    !(reviewer as Pick<Reviewer, "seen_ranking_onboarding_at" | "review_count">)
      .seen_ranking_onboarding_at &&
    (reviewer as Pick<Reviewer, "review_count">).review_count > 0
  ) {
    redirect("/list/onboarding");
  }

  const { data: reviewsRaw } = await supabase
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, rank_position, body, visited_on, created_at, updated_at",
    )
    .eq("reviewer_id", user.id)
    .order("rank_position", { ascending: true });

  const reviews = (reviewsRaw ?? []) as Review[];
  const venueIds = Array.from(new Set(reviews.map((r) => r.venue_id)));
  const venuesById = new Map<string, { name: string; slug: string }>();
  if (venueIds.length > 0) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name, slug")
      .in("id", venueIds);
    for (const v of (venueRows ?? []) as Array<{ id: string; name: string; slug: string }>) {
      venuesById.set(v.id, { name: v.name, slug: v.slug });
    }
  }

  const initialByBucket: Record<ReviewBucket, RankedItem[]> = {
    pilgrimage: [],
    detour: [],
    convenience: [],
  };
  for (const r of reviews) {
    const v = venuesById.get(r.venue_id);
    if (!v) continue;
    initialByBucket[r.bucket].push({
      id: r.id,
      venueId: r.venue_id,
      venueSlug: v.slug,
      venueName: v.name,
      rating_overall: r.rating_overall,
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "hsl(20 14.3% 4%)" }}>
      <SiteHeader />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 96px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...MONO, color: "hsl(24 5.4% 50%)", marginBottom: 8 }}>
            Your list
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px,4vw,40px)",
              color: "hsl(60 9.1% 97.8%)",
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            Where every venue stands
          </h1>
          <p style={{ fontSize: 14, color: "hsl(24 5.4% 60%)" }}>
            Drag to reorder within a bucket, or across to change bucket.
          </p>
        </div>

        {reviews.length === 0 ? (
          <div
            style={{
              padding: "20px 18px",
              borderRadius: 4,
              border: "1px dashed rgba(255,255,255,0.12)",
              fontSize: 14,
              color: "hsl(24 5.4% 60%)",
            }}
          >
            No reviews yet.{" "}
            <Link
              href="/venues"
              style={{ color: "oklch(0.75 0.11 44)", textDecoration: "underline" }}
            >
              Browse venues
            </Link>
            .
          </div>
        ) : (
          <RankedList initialByBucket={initialByBucket} />
        )}
      </main>
    </div>
  );
}
