import Link from "next/link";

import type { VenueRankingSummary } from "@/lib/ranking-context";

import { RankingBadge } from "./RankingBadge";
import { ScoreBandBadge } from "./ScoreBandBadge";
import { SignalBadge } from "./SignalBadge";

type Props = {
  summary: VenueRankingSummary;
  /**
   * If provided, the unranked CTA "Help this venue enter the rankings."
   * becomes a link. Omit when the parent element is already a link (e.g. a
   * card wrapped in <Link>) to avoid nested anchors.
   */
  reviewHref?: string;
};

export function VenueRankingMeta({ summary, reviewHref }: Props) {
  if (summary.isUnranked) {
    return (
      <div className="mt-2 space-y-0.5 text-xs text-[var(--color-muted-foreground)]">
        <div className="font-medium">Unranked</div>
        <div>{summary.reviewPrompt}</div>
        {reviewHref ? (
          <div>
            <Link
              href={reviewHref}
              className="underline underline-offset-2 hover:text-[var(--color-foreground)]"
            >
              Help this venue enter the rankings.
            </Link>
          </div>
        ) : (
          <div>Help this venue enter the rankings.</div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {summary.rank !== null ? (
        <RankingBadge rank={summary.rank} scopeLabel={summary.scopeLabel} />
      ) : null}
      <ScoreBandBadge label={summary.scoreLabel} tone={summary.scoreTone} />
      <SignalBadge label={summary.signalLabel} />
    </div>
  );
}
