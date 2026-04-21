import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { fetchProfileByUserId } from "@/app/profile/_lib/fetch-profile";
import { ProfileView } from "@/app/profile/_components/profile-view";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="mb-8 block text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        ← Home
      </Link>

      <ProfileView data={data} isOwnProfile={isOwnProfile} />
    </main>
  );
}
