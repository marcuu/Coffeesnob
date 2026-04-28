// Lightweight client-side analytics wrapper.
// TODO: replace the console.debug sink with a real provider (PostHog,
// Segment, etc.) once one is chosen. The shape below is intentionally
// stable so call sites don't need to change.

import type { ReviewBucket } from "@/lib/types";

export type RankingEvent =
  | { name: "bucket_selected"; bucket: ReviewBucket }
  | { name: "tournament_started"; bucket_size: number }
  | {
      name: "tournament_comparison_made";
      step_index: number;
      result: "better" | "worse" | "same";
    }
  | {
      name: "tournament_completed";
      bucket: ReviewBucket;
      comparisons_count: number;
      duration_ms: number;
      final_rank: number;
    }
  | {
      name: "review_submitted";
      bucket: ReviewBucket;
      list_changed?: boolean;
    }
  | {
      name: "list_reordered";
      mode: "within_bucket" | "cross_bucket";
    }
  | {
      name: "rank_collision_after_compact";
      bucket: ReviewBucket;
      reviewer_id: string;
    };

export function track(event: RankingEvent): void {
  if (typeof window === "undefined") {
    // Server-side path. Log via console with a stable prefix so it's
    // grep-able in deployment logs.
    console.debug("[analytics:server]", event.name, event);
    return;
  }
  // Client-side path. Only logs in development; production builds will
  // emit through the configured provider once wired.
  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", event.name, event);
  }
  // Provider integration goes here.
}
