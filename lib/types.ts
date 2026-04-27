// Domain types matching supabase/migration.sql.
// Keep this file in sync with the SQL schema; prefer generating types from
// the Supabase CLI once the project is connected.

export type BrewMethod =
  | "espresso"
  | "filter"
  | "pour_over"
  | "batch_brew"
  | "aeropress"
  | "cold_brew";

export interface Reviewer {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_city: string | null;
  status: "beaned" | "invited" | "active";
  review_count: number;
  venues_reviewed_count: number;
  first_review_at: string | null;
  last_review_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postcode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  instagram: string | null;
  roasters: string[];
  brew_methods: BrewMethod[];
  has_decaf: boolean | null;
  has_plant_milk: boolean | null;
  notes: string | null;
  photo_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ReviewBucket = "pilgrimage" | "detour" | "convenience";

export interface Review {
  id: string;
  venue_id: string;
  reviewer_id: string;
  rating_overall: number;
  rating_taste: number | null;
  rating_body: number | null;
  rating_aroma: number | null;
  rating_ambience: number;
  rating_service: number;
  rating_value: number;
  bucket: ReviewBucket;
  rank_position: number;
  body: string;
  visited_on: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewComparison {
  id: string;
  reviewer_id: string;
  winning_review_id: string | null;
  losing_review_id: string | null;
  result: "better" | "worse" | "same";
  created_at: string;
}

// One entry per comparison made during a tournament. Captured client-side and
// replayed server-side on submit so the persistence layer can validate the
// claimed rank position. step_index is 0-based and monotonic within a
// tournament; against_review_id is the existing review the new venue was
// compared against at that step.
export type ComparisonHistory = Array<{
  against_review_id: string;
  result: "better" | "worse" | "same";
  step_index: number;
}>;

export type RatingAxis =
  | "rating_overall"
  | "rating_taste"
  | "rating_body"
  | "rating_aroma"
  | "rating_ambience"
  | "rating_service"
  | "rating_value";

export const RATING_AXES: readonly RatingAxis[] = [
  "rating_overall",
  "rating_taste",
  "rating_body",
  "rating_aroma",
  "rating_ambience",
  "rating_service",
  "rating_value",
] as const;
