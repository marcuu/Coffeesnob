import { notFound } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

import { ReviewForm } from "../review-form";

export const dynamic = "force-dynamic";

export default async function AddVenueReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: venue, error } = await supabase
    .from("venues")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!venue) notFound();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(20 14.3% 4%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ReviewForm venueId={venue.id} slug={slug} venueName={venue.name} />
    </div>
  );
}
