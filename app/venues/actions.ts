"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import {
  formNumber,
  formString,
  parseCsv,
  venueCreateSchema,
} from "@/lib/validators";

export type VenueFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const initial: VenueFormState = { status: "idle" };

export async function createVenue(
  _prev: VenueFormState = initial,
  formData: FormData,
): Promise<VenueFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Not authenticated" };
  }

  const raw = {
    slug: formString(formData.get("slug")),
    name: formString(formData.get("name")),
    address_line1: formString(formData.get("address_line1")),
    address_line2: formString(formData.get("address_line2")),
    city: formString(formData.get("city")),
    postcode: formString(formData.get("postcode")),
    country: formString(formData.get("country")) ?? "GB",
    latitude: formNumber(formData.get("latitude")) ?? null,
    longitude: formNumber(formData.get("longitude")) ?? null,
    website: formString(formData.get("website")) ?? null,
    instagram: formString(formData.get("instagram")),
    roasters: parseCsv(formData.get("roasters")),
    brew_methods: parseCsv(formData.get("brew_methods")),
    has_decaf: formData.get("has_decaf") === "on",
    has_plant_milk: formData.get("has_plant_milk") === "on",
    notes: formString(formData.get("notes")),
  };

  const parsed = venueCreateSchema.safeParse(raw);
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

  const { data: inserted, error } = await supabase
    .from("venues")
    .insert({ ...parsed.data, created_by: user.id })
    .select("slug")
    .single();

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/venues");
  redirect(`/venues/${inserted.slug}`);
}

export async function deleteVenue(formData: FormData) {
  const id = formString(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS enforces created_by = auth.uid(); this is belt-and-braces.
  await supabase.from("venues").delete().eq("id", id).eq("created_by", user.id);

  revalidatePath("/venues");
  redirect("/venues");
}
