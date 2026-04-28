import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { fetchProfileByUserId } from "./_lib/fetch-profile";
import { ProfileView } from "./_components/profile-view";

export const dynamic = "force-dynamic";

export default async function OwnProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileData = await fetchProfileByUserId(supabase, user.id, user.id);
  if (!profileData) redirect("/login");
  // redirect() throws — assertion tells TS the value is defined below.
  const data = profileData!;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm text-[var(--color-muted-foreground)] hover:underline"
        >
          ← Home
        </Link>
        {data.reviewer.username && (
          <Link
            href={`/profile/${data.reviewer.username}`}
            className="text-sm text-[var(--color-muted-foreground)] hover:underline"
          >
            Shared profile link →
          </Link>
        )}
      </div>

      <ProfileView data={data} isOwnProfile={true} />
    </main>
  );
}
