import { notFound, redirect } from "next/navigation";

import type { Review, ReviewBucket } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

export default async function AddVenueReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const handle = (reviewer as { username: string | null } | null)?.username ?? undefined;

  const { data: venue, error } = await supabase
    .from("venues")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!venue) notFound();

  // Pre-fetch the user's existing reviews + the venue names attached to them,
  // so the tournament UI can render head-to-heads without round-trips.
  const { data: ownReviews } = await supabase
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, rank_position, body, visited_on, created_at, updated_at",
    )
    .eq("reviewer_id", user.id);

  const reviews = ((ownReviews ?? []) as Review[]).filter(
    (r) => r.bucket !== null,
  );

  const venueIds = Array.from(new Set(reviews.map((r) => r.venue_id)));
  const candidateNamesByReviewId: Record<string, string> = {};
  if (venueIds.length > 0) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name")
      .in("id", venueIds);
    const venueNameById = new Map<string, string>(
      ((venueRows ?? []) as Array<{ id: string; name: string }>).map((v) => [
        v.id,
        v.name,
      ]),
    );
    for (const r of reviews) {
      candidateNamesByReviewId[r.id] = venueNameById.get(r.venue_id) ?? "";
    }
  }

  const reviewsByBucket: Record<ReviewBucket, Review[]> = {
    pilgrimage: [],
    detour: [],
    convenience: [],
  };
  for (const r of reviews) {
    reviewsByBucket[r.bucket].push(r);
  }
  for (const k of Object.keys(reviewsByBucket) as ReviewBucket[]) {
    reviewsByBucket[k].sort((a, b) => a.rank_position - b.rank_position);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(20 14.3% 4%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ReviewForm
        venueId={venue.id}
        slug={slug}
        venueName={venue.name}
        reviewsByBucket={reviewsByBucket}
        candidateNamesByReviewId={candidateNamesByReviewId}
        handle={handle}
      />
    </div>
  );
}
