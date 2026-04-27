import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getWeeklyInviteLimit,
  maskInviteeEmail,
  startOfUtcWeek,
} from "@/lib/invites";
import {
  computeReputationTier,
  computeStreak,
  deriveTasteProfile,
} from "@/lib/profile";
import type { Invite, Reviewer } from "@/lib/types";

export type ReviewWithVenue = {
  id: string;
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
  venue: {
    name: string;
    slug: string;
    city: string;
    brew_methods: string[];
  };
};

export type InviteActivityItem = {
  id: string;
  status: Invite["status"];
  inviteeEmail: string;
  inviteeMask: string;
  inviteeUsername: string | null;
  inviteeDisplayName: string | null;
  createdAt: string;
  acceptedAt: string | null;
};

export type ProfileData = {
  reviewer: Reviewer;
  reviews: ReviewWithVenue[];
  citiesCount: number;
  streak: number;
  tasteProfile: ReturnType<typeof deriveTasteProfile>;
  reputation: ReturnType<typeof computeReputationTier>;
  invites: {
    weeklyLimit: number;
    usedThisWeek: number;
    remainingThisWeek: number;
    isHighSignal: boolean;
  };
  inviteActivity: InviteActivityItem[];
};

export async function fetchProfileByUserId(
  supabase: SupabaseClient,
  reviewerId: string,
): Promise<ProfileData | null> {
  const weekStart = startOfUtcWeek(new Date());

  const [reviewerResult, reviewsResult, tenureResult, invitesResult, invitesUsedResult] =
    await Promise.all([
      supabase.from("reviewers").select("*").eq("id", reviewerId).maybeSingle(),
      supabase
        .from("reviews")
        .select(
          "id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, body, visited_on, created_at, venue:venues(name, slug, city, brew_methods)",
        )
        .eq("reviewer_id", reviewerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("reviewer_tenure")
        .select("tenure_score, consistency_score")
        .eq("reviewer_id", reviewerId)
        .maybeSingle(),
      supabase
        .from("invites")
        .select(
          "id, status, invitee_email, created_at, accepted_at, invitee:reviewers!invites_invitee_user_id_fkey(username, display_name)",
        )
        .eq("inviter_id", reviewerId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("invites")
        .select("id", { count: "exact", head: true })
        .eq("inviter_id", reviewerId)
        .gte("created_at", weekStart)
        .in("status", ["pending", "accepted"]),
    ]);

  if (!reviewerResult.data) return null;

  const reviewer = reviewerResult.data as Reviewer;
  const reviews = (reviewsResult.data ?? []) as unknown as ReviewWithVenue[];
  const tenure = tenureResult.data ?? null;

  const cities = new Set(reviews.map((r) => r.venue?.city).filter(Boolean));
  const weeklyLimit = getWeeklyInviteLimit(reviewer);
  const usedThisWeek = invitesUsedResult.count ?? 0;

  type InviteQueryRow = {
    id: string;
    status: Invite["status"];
    invitee_email: string;
    created_at: string;
    accepted_at: string | null;
    invitee:
      | {
          username: string | null;
          display_name: string;
        }
      | {
          username: string | null;
          display_name: string;
        }[]
      | null;
  };

  const inviteActivity = ((invitesResult.data ?? []) as unknown as InviteQueryRow[]).map(
    (row) => {
      const invitee = Array.isArray(row.invitee) ? row.invitee[0] : row.invitee;

      return {
        id: row.id,
        status: row.status,
        inviteeEmail: row.invitee_email,
        inviteeMask: maskInviteeEmail(row.invitee_email),
        inviteeUsername: invitee?.username ?? null,
        inviteeDisplayName: invitee?.display_name ?? null,
        createdAt: row.created_at,
        acceptedAt: row.accepted_at,
      };
    },
  );

  return {
    reviewer,
    reviews,
    citiesCount: cities.size,
    streak: computeStreak(reviews.map((r) => r.visited_on)),
    tasteProfile: deriveTasteProfile(reviews),
    reputation: computeReputationTier(reviewer, tenure),
    invites: {
      weeklyLimit,
      usedThisWeek,
      remainingThisWeek: Math.max(0, weeklyLimit - usedThisWeek),
      isHighSignal: weeklyLimit > 3,
    },
    inviteActivity,
  };
}
