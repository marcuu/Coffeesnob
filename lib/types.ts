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
  body: string;
  visited_on: string;
  created_at: string;
  updated_at: string;
}


export interface Invite {
  id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_user_id: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

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
