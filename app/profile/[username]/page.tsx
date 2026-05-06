import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { fetchProfileByUserId } from "@/app/profile/_lib/fetch-profile";
import { ProfileView } from "@/app/profile/_components/profile-view";

import { WishlistSection, type WishlistItem } from "./wishlist";

export const dynamic = "force-dynamic";

export default async function SharedProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lookupClient = user ? supabase : createServiceRoleClient();
  const { data: reviewerRow } = await lookupClient
    .from("reviewers")
    .select("id, is_synthetic")
    .eq("username", username)
    .maybeSingle();

  if (!reviewerRow) notFound();
  if (!user && !reviewerRow.is_synthetic) redirect("/login");

  const profileData = await fetchProfileByUserId(lookupClient, reviewerRow.id);
  if (!profileData) notFound();

  const isOwnProfile = user?.id === reviewerRow.id;
  const { data: wishlistRows } = await lookupClient
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
    .map((r) => ({ venueId: r.venue_id, slug: r.venue!.slug, name: r.venue!.name, city: r.venue!.city, addedAt: r.added_at }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href={profileData.reviewer.is_synthetic ? "/bramford" : "/"} className="mb-8 block text-sm text-[var(--color-muted-foreground)] hover:underline">
        Back
      </Link>
      <ProfileView data={profileData} isOwnProfile={Boolean(isOwnProfile)} />
      {!profileData.reviewer.is_synthetic ? <WishlistSection items={wishlist} isOwnProfile={Boolean(isOwnProfile)} /> : null}
    </main>
  );
}
