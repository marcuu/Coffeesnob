import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { fetchProfileByUserId } from "@/app/profile/_lib/fetch-profile";
import { ProfileView } from "@/app/profile/_components/profile-view";

import { WishlistSection, type WishlistItem } from "./wishlist";

export const dynamic = "force-dynamic";

// Visible to any signed-in (allowlisted) user. Auth is required because
// reviewer data is gated by the is_allowed_email() RLS policy.
export default async function SharedProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reviewerRow } = await supabase
    .from("reviewers")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (!reviewerRow) notFound();

  const profileData = await fetchProfileByUserId(supabase, reviewerRow.id);
  if (!profileData) notFound();
  // notFound() throws — assertion tells TS the value is defined below.
  const data = profileData!;

  const isOwnProfile = user.id === reviewerRow.id;

  // Wishlist (PRD §6 FR7). Public-by-default per PRD §11 Q3.
  const { data: wishlistRows } = await supabase
    .from("review_wishlist")
    .select("venue_id, added_at, venue:venues(name, slug, city)")
    .eq("reviewer_id", reviewerRow.id)
    .order("added_at", { ascending: false });

  const wishlist: WishlistItem[] = (
    (wishlistRows ?? []) as unknown as Array<{
      venue_id: string;
      added_at: string;
      venue: { name: string; slug: string; city: string } | null;
    }>
  )
    .filter((r) => r.venue !== null)
    .map((r) => ({
      venueId: r.venue_id,
      slug: r.venue!.slug,
      name: r.venue!.name,
      city: r.venue!.city,
      addedAt: r.added_at,
    }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="mb-8 block text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        ← Home
      </Link>

      <ProfileView data={data} isOwnProfile={isOwnProfile} />

      <WishlistSection items={wishlist} isOwnProfile={isOwnProfile} />
    </main>
  );
}
