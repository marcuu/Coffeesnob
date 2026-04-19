import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";

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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href={`/venues/${slug}`}
        className="text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        ← Back to venue
      </Link>
      <div className="mt-4 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Review {venue.name}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Move through six scoring steps, then add your notes.
        </p>
      </div>

      <div className="mt-6">
        <ReviewForm venueId={venue.id} slug={slug} />
      </div>
      <div className="mt-6">
        <Button asChild variant="ghost">
          <Link href={`/venues/${slug}`}>Done reviewing</Link>
        </Button>
      </div>
    </main>
  );
}
