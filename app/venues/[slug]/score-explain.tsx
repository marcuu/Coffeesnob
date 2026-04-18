import type { VenueScoreExplanation } from "@/lib/aggregation";

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function ScoreExplain({ data }: { data: VenueScoreExplanation }) {
  const {
    displayedScore,
    confidence,
    totalReviews,
    effectiveReviews,
    topContributors,
    recencyProfile,
    priorPull,
  } = data;

  return (
    <details className="mt-4 rounded-md border border-[var(--color-border)] px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium">
        How is this calculated?
      </summary>

      <div className="mt-3 space-y-3 text-[var(--color-muted-foreground)]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>Displayed score</div>
          <div className="text-right font-medium text-[var(--color-foreground)]">
            {displayedScore.toFixed(1)}
          </div>
          <div>Confidence</div>
          <div className="text-right font-medium text-[var(--color-foreground)]">
            {confidence.toFixed(2)}
          </div>
          <div>Reviews (total)</div>
          <div className="text-right font-medium text-[var(--color-foreground)]">
            {totalReviews}
          </div>
          <div>Reviews (counted)</div>
          <div className="text-right font-medium text-[var(--color-foreground)]">
            {effectiveReviews}
          </div>
          <div>Prior pull</div>
          <div className="text-right font-medium text-[var(--color-foreground)]">
            {priorPull.toFixed(2)}
          </div>
        </div>

        {topContributors.length > 0 ? (
          <div>
            <div className="font-medium text-[var(--color-foreground)]">
              Top reviewers by weight
            </div>
            <ul className="mt-1 space-y-0.5">
              {topContributors.map((c, i) => (
                <li
                  key={`${c.reviewerDisplayName}-${i}`}
                  className="flex justify-between gap-4"
                >
                  <span className="truncate">
                    {c.reviewerDisplayName} · {c.score}/10 · {c.visitedOn}
                  </span>
                  <span className="tabular-nums">
                    {c.weightContribution.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="font-medium text-[var(--color-foreground)]">
            Recency (share of counted weight)
          </div>
          <div className="mt-1 grid grid-cols-3 gap-x-4 text-xs">
            <div>
              <div>Last 6 months</div>
              <div className="font-medium text-[var(--color-foreground)]">
                {formatPct(recencyProfile.last6Months)}
              </div>
            </div>
            <div>
              <div>6-18 months</div>
              <div className="font-medium text-[var(--color-foreground)]">
                {formatPct(recencyProfile.sixTo18Months)}
              </div>
            </div>
            <div>
              <div>Older</div>
              <div className="font-medium text-[var(--color-foreground)]">
                {formatPct(recencyProfile.older)}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs">
          Scores combine each review&apos;s rating with a reviewer-specific
          weight (based on status, tenure, consistency, recency, and
          completeness), then blend with a Bayesian prior so sparsely-reviewed
          venues don&apos;t swing on a single rating. Reviews with weight below
          0.05 are dropped from the displayed score.
        </p>
      </div>
    </details>
  );
}
