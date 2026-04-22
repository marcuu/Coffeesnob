"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { formString, profileUpdateSchema } from "@/lib/validators";

export type ProfileFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    }
  | { status: "success" };

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "error", message: "Not authenticated" };

  const raw = {
    display_name: formString(formData.get("display_name")),
    username: formString(formData.get("username")) ?? "",
    bio: formString(formData.get("bio")),
    home_city: formString(formData.get("home_city")),
    avatar_url: formString(formData.get("avatar_url")) ?? "",
  };

  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "form";
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors,
    };
  }

  const { display_name, username, bio, home_city, avatar_url } = parsed.data;

  // Normalise empty strings to null for nullable columns.
  const usernameValue = username && username.length > 0 ? username : null;
  const avatarValue = avatar_url && avatar_url.length > 0 ? avatar_url : null;

  // If setting a username, verify it isn't already taken by someone else.
  if (usernameValue) {
    const { data: existing } = await supabase
      .from("reviewers")
      .select("id")
      .eq("username", usernameValue)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return {
        status: "error",
        message: "Username is already taken",
        fieldErrors: { username: "Username is already taken" },
      };
    }
  }

  const { error } = await supabase
    .from("reviewers")
    .update({
      display_name,
      username: usernameValue,
      bio: bio ?? null,
      home_city: home_city ?? null,
      avatar_url: avatarValue,
    })
    .eq("id", user.id);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/profile");
  if (usernameValue) {
    revalidatePath(`/profile/${usernameValue}`);
  }

  redirect("/profile");
  // redirect() always throws; this satisfies TypeScript's return analysis.
  return { status: "success" };
}
