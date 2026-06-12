import { z } from "zod";

import { type BrewMethod, RATING_AXES } from "@/lib/types";

export const REVIEW_BUCKETS = [
  "pilgrimage",
  "detour",
  "convenience",
] as const;

export const BREW_METHODS = [
  "espresso",
  "filter",
  "pour_over",
  "batch_brew",
  "aeropress",
  "cold_brew",
] as const satisfies readonly BrewMethod[];

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only",
  );

const rating5 = z.number().int().min(1).max(5);

export const venueCreateSchema = z.object({
  slug,
  name: z.string().trim().min(1).max(120),
  address_line1: z.string().trim().min(1).max(200),
  address_line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(80),
  postcode: z.string().trim().min(2).max(10),
  country: z.string().trim().length(2).default("GB"),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  website: z.string().trim().url("Website must be a valid URL").optional(),
  instagram: z.string().trim().max(60).optional(),
  roasters: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  brew_methods: z
    .array(z.enum(BREW_METHODS))
    .max(BREW_METHODS.length)
    .default([]),
  has_decaf: z.boolean().nullable().optional(),
  has_plant_milk: z.boolean().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type VenueCreateInput = z.infer<typeof venueCreateSchema>;

export const venueUpdateSchema = venueCreateSchema.partial();
export type VenueUpdateInput = z.infer<typeof venueUpdateSchema>;

// Ranked-review submission. Replaces the old rating_overall slider with a
// bucket choice + a client-side binary tournament. The six axis sliders
// have been replaced by two — coffee + vibe — both 1-5 and required. The
// history is replayed server-side to validate the claimed rankPosition.
export const comparisonHistoryEntrySchema = z.object({
  against_review_id: z.string().uuid(),
  result: z.enum(["better", "worse", "same"]),
  step_index: z.number().int().min(0),
});

export const rankedReviewCreateSchema = z.object({
  venue_id: z.string().uuid(),
  visited_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  bucket: z.enum(REVIEW_BUCKETS),
  rank_position: z.number().int(),
  history: z.array(comparisonHistoryEntrySchema).max(64),
  rating_coffee_5: rating5,
  rating_vibe_5: rating5,
  body: z.string().trim().max(5000).optional(),
  // Quick re-log: id of the user's prior review of the same venue. The new
  // review stacks as an additional data point, placed adjacent to the prior
  // one instead of re-running the tournament.
  relog_of: z.string().uuid().optional(),
});

export type RankedReviewCreateInput = z.infer<typeof rankedReviewCreateSchema>;

export const profileUpdateSchema = z.object({
  display_name: z.string().trim().min(1, "Display name is required").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Username must be at least 2 characters")
    .max(30, "Username must be 30 characters or fewer")
    .regex(
      /^[a-z0-9][a-z0-9_-]{1,29}$/,
      "Use lowercase letters, numbers, underscores or hyphens",
    )
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(300, "Bio must be 300 characters or fewer").optional(),
  home_city: z
    .string()
    .trim()
    .max(80, "City must be 80 characters or fewer")
    .optional(),
  avatar_url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// Parses a comma-separated text input into a trimmed string[].
export function parseCsv(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Narrows a FormData string entry to string | undefined (empty → undefined).
export function formString(
  value: FormDataEntryValue | null,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function formNumber(
  value: FormDataEntryValue | null,
): number | undefined {
  const s = formString(value);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export { RATING_AXES };
