"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { geocodePostcode } from "@/lib/geo";
import { createClient } from "@/utils/supabase/server";
import {
  formString,
  parseCsv,
  venueQuickCreateSchema,
  venueUpdateSchema,
} from "@/lib/validators";

export type VenueFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
      _key?: number;
    };

const initial: VenueFormState = { status: "idle" };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function fieldErrorsFrom(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".") || "form";
    if (!fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

// Creation is three fields: name, city, postcode. The slug is derived from
// the name (with a numeric suffix on collision), coordinates are geocoded
// from the postcode, and everything else is added later from the venue page.
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

  const savedValues: Record<string, string> = {
    name: String(formData.get("name") ?? ""),
    city: String(formData.get("city") ?? ""),
    postcode: String(formData.get("postcode") ?? ""),
  };

  const parsed = venueQuickCreateSchema.safeParse({
    name: formString(formData.get("name")),
    city: formString(formData.get("city")),
    postcode: formString(formData.get("postcode")),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      values: savedValues,
      _key: Date.now(),
    };
  }

  const baseSlug = slugify(parsed.data.name) || "venue";
  const coords = await geocodePostcode(parsed.data.postcode);

  // Try the natural slug, then numbered variants on collision.
  let createdSlug: string | null = null;
  let lastError = "";
  for (let i = 0; i < 5 && !createdSlug; i++) {
    const slug = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    const { data: inserted, error } = await supabase
      .from("venues")
      .insert({
        ...parsed.data,
        slug,
        address_line1: "",
        ...(coords ?? {}),
        created_by: user.id,
      })
      .select("slug")
      .single();
    if (!error) {
      createdSlug = inserted.slug;
      break;
    }
    lastError = error.message;
    const slugCollision =
      error.code === "23505" && /slug/i.test(error.message ?? "");
    if (!slugCollision) {
      return { status: "error", message: error.message, values: savedValues };
    }
  }
  if (!createdSlug) {
    return { status: "error", message: lastError, values: savedValues };
  }

  revalidatePath("/venues");
  redirect(`/venues/${createdSlug}`);
}

// Post-creation details, editable by the venue's creator (RLS enforces
// created_by; the eq() below is belt-and-braces).
export async function updateVenueDetails(
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

  const slug = formString(formData.get("slug"));
  if (!slug) return { status: "error", message: "Missing venue" };

  const raw = {
    // Blank inputs are omitted (no change) rather than written as empty.
    address_line1: formString(formData.get("address_line1")),
    address_line2: formString(formData.get("address_line2")),
    website: formString(formData.get("website")),
    instagram: formString(formData.get("instagram")),
    roasters: parseCsv(formData.get("roasters")),
    brew_methods: parseCsv(formData.get("brew_methods")),
    has_decaf: formData.get("has_decaf") === "on",
    has_plant_milk: formData.get("has_plant_milk") === "on",
    notes: formString(formData.get("notes")),
  };

  const parsed = venueUpdateSchema
    .omit({ slug: true, name: true, city: true, postcode: true, country: true, latitude: true, longitude: true })
    .safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
      _key: Date.now(),
    };
  }

  const { error } = await supabase
    .from("venues")
    .update(parsed.data)
    .eq("slug", slug)
    .eq("created_by", user.id);
  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath(`/venues/${slug}`);
  redirect(`/venues/${slug}`);
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
