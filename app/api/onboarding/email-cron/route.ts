// Onboarding follow-up cron. POST-only. Bearer-token auth against
// ONBOARDING_EMAIL_CRON_SECRET. Invoked hourly by Vercel cron (see
// vercel.json). For each reviewer who:
//   - completed onboarding 24-48h ago, AND
//   - has not been emailed yet,
// pick their top similar reviewer + that reviewer's top Pilgrimage venue
// the user hasn't ranked, render the template, send via Resend, and
// record the send. PRD §6 FR8.

import { NextResponse } from "next/server";

import { renderOnboardingFollowup } from "@/lib/email/templates/onboarding-followup";
import { sendEmail } from "@/lib/email/resend";
import {
  buildReviewerVector,
  topSimilarReviewers,
  type PrimingReview,
} from "@/lib/onboarding/similarity";
import type { ReviewBucket } from "@/lib/types";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

const WINDOW_LOWER_HOURS = 24;
const WINDOW_UPPER_HOURS = 48;

// Vercel cron sends GET; allow POST too for manual / external invocation.
export async function GET(request: Request): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handle(request);
}

async function handle(request: Request): Promise<NextResponse> {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Use that env
  // var to match the platform default; manual / external invocations need
  // to send the same secret.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[onboarding/email-cron] CRON_SECRET not configured");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceRoleClient();
  const requestId = crypto.randomUUID();

  try {
    const now = new Date();
    const lower = new Date(now.getTime() - WINDOW_UPPER_HOURS * 3600_000);
    const upper = new Date(now.getTime() - WINDOW_LOWER_HOURS * 3600_000);

    // Reviewers eligible: completed onboarding in the [lower, upper] window
    // and not already in onboarding_emails_sent.
    const { data: candidates, error: candidatesError } = await sb
      .from("reviewers")
      .select("id, display_name, seen_onboarding_at")
      .gte("seen_onboarding_at", lower.toISOString())
      .lt("seen_onboarding_at", upper.toISOString());

    if (candidatesError) {
      throw new Error(`candidates_fetch: ${candidatesError.message}`);
    }

    const candidateIds = (candidates ?? []).map((c) => c.id as string);
    if (candidateIds.length === 0) {
      return NextResponse.json({ requestId, sent: 0, skipped: 0 });
    }

    const { data: alreadySent } = await sb
      .from("onboarding_emails_sent")
      .select("reviewer_id")
      .in("reviewer_id", candidateIds);
    const sentSet = new Set(
      (alreadySent ?? []).map((r) => r.reviewer_id as string),
    );

    const eligible = (candidates ?? []).filter((c) => !sentSet.has(c.id as string));
    if (eligible.length === 0) {
      return NextResponse.json({ requestId, sent: 0, skipped: candidateIds.length });
    }

    const { data: emailRows } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map<string, string>();
    for (const u of emailRows?.users ?? []) {
      if (u.id && u.email) emailById.set(u.id, u.email);
    }

    // Pre-compute priming-vector data once for the whole population.
    const { data: primingVenues } = await sb
      .from("venues")
      .select("id, slug, name")
      .eq("is_priming_venue", true);
    const primingVenueIds = (primingVenues ?? []).map((v) => v.id as string);
    const venueMetaById = new Map<string, { slug: string; name: string }>();
    for (const v of (primingVenues ?? []) as Array<{
      id: string;
      slug: string;
      name: string;
    }>) {
      venueMetaById.set(v.id, { slug: v.slug, name: v.name });
    }

    const { data: allReviews } = await sb
      .from("reviews")
      .select("reviewer_id, venue_id, bucket, rating_coffee_5, rating_vibe_5")
      .in("venue_id", primingVenueIds);

    const reviewsByReviewer = new Map<string, PrimingReview[]>();
    for (const r of (allReviews ?? []) as Array<{
      reviewer_id: string;
      venue_id: string;
      bucket: ReviewBucket;
      rating_coffee_5: number;
      rating_vibe_5: number;
    }>) {
      const list = reviewsByReviewer.get(r.reviewer_id) ?? [];
      list.push({
        venueId: r.venue_id,
        bucket: r.bucket,
        ratingCoffee5: r.rating_coffee_5,
        ratingVibe5: r.rating_vibe_5,
      });
      reviewsByReviewer.set(r.reviewer_id, list);
    }

    const { data: reviewerProfiles } = await sb
      .from("reviewers")
      .select("id, display_name");
    const profileById = new Map<string, { display_name: string }>();
    for (const p of (reviewerProfiles ?? []) as Array<{
      id: string;
      display_name: string;
    }>) {
      profileById.set(p.id, p);
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://caffiends.example";

    let sent = 0;
    let skipped = 0;

    for (const c of eligible) {
      const recipient = emailById.get(c.id as string);
      if (!recipient) {
        skipped++;
        continue;
      }

      const myReviews = reviewsByReviewer.get(c.id as string) ?? [];
      const me = buildReviewerVector(c.id as string, myReviews, primingVenueIds);

      const others = Array.from(reviewsByReviewer.entries())
        .filter(([id]) => id !== c.id)
        .map(([id, rs]) => buildReviewerVector(id, rs, primingVenueIds));
      const top = topSimilarReviewers(me, others, 1);

      let topMatchName: string | undefined;
      let topMatchSimilarityPct: number | undefined;
      let pilgrimageVenueName: string | undefined;
      let pilgrimageVenueSlug: string | undefined;

      if (top.length > 0) {
        const match = top[0];
        topMatchName = profileById.get(match.reviewerId)?.display_name;
        topMatchSimilarityPct = Math.round(match.similarity * 100);
        const myRanked = new Set(myReviews.map((r) => r.venueId));
        const matchPilgrimages = (
          reviewsByReviewer.get(match.reviewerId) ?? []
        ).filter((r) => r.bucket === "pilgrimage" && !myRanked.has(r.venueId));
        if (matchPilgrimages.length > 0) {
          const pick = matchPilgrimages[0];
          const meta = venueMetaById.get(pick.venueId);
          if (meta) {
            pilgrimageVenueName = meta.name;
            pilgrimageVenueSlug = meta.slug;
          }
        }
      }

      const { subject, html } = renderOnboardingFollowup({
        displayName: c.display_name as string,
        topMatchName,
        topMatchSimilarityPct,
        pilgrimageVenueName,
        pilgrimageVenueSlug,
        appBaseUrl,
      });

      const result = await sendEmail({ to: recipient, subject, html });
      if (!result.ok) {
        console.error(
          `[onboarding/email-cron] send failed for ${c.id}`,
          result.error,
        );
        skipped++;
        continue;
      }

      const { error: insertError } = await sb
        .from("onboarding_emails_sent")
        .insert({ reviewer_id: c.id });
      if (insertError && insertError.code !== "23505") {
        console.error(
          `[onboarding/email-cron] throttle insert failed for ${c.id}`,
          insertError,
        );
      }
      sent++;
    }

    return NextResponse.json({ requestId, sent, skipped });
  } catch (err) {
    console.error(`[onboarding/email-cron] requestId=${requestId}`, err);
    return NextResponse.json(
      { error: "internal_error", requestId },
      { status: 500 },
    );
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
