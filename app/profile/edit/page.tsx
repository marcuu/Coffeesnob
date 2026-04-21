import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import type { Reviewer } from "@/lib/types";

import { EditProfileForm } from "./edit-profile-form";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("reviewers")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) redirect("/profile");

  const reviewer = data as Reviewer;

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link
        href="/profile"
        className="text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        ← Back to profile
      </Link>

      <h1
        className="mt-6 text-2xl font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Edit profile
      </h1>

      <div className="mt-8">
        <EditProfileForm reviewer={reviewer} />
      </div>
    </main>
  );
}
