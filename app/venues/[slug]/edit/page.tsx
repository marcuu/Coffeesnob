import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import type { Venue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

import { VenueDetailsForm } from "./details-form";

export const dynamic = "force-dynamic";

export default async function EditVenuePage({
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

  const { data: venue, error } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!venue) notFound();

  const venueRow = venue as Venue;
  if (venueRow.created_by !== user.id) {
    // Only the creator edits details; everyone else goes back to the venue.
    redirect(`/venues/${slug}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <Link
            href={`/venues/${slug}`}
            className="text-sm text-[var(--color-muted-foreground)] hover:underline"
          >
            ← {venueRow.name}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Details
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            All optional. Fill in what you know.
          </p>
        </div>

        <VenueDetailsForm venue={venueRow} />
      </main>
    </>
  );
}
