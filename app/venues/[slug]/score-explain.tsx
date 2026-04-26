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
    <details style={{ display: "inline-block", position: "relative", verticalAlign: "middle" }}>
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid var(--color-border)",
          color: "var(--color-muted-foreground)",
          userSelect: "none",
        }}
        title="How is this calculated?"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="4.5" stroke="currentColor" strokeWidth="1" />
          <path d="M5 4.5v3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <circle cx="5" cy="3" r="0.5" fill="currentColor" />
        </svg>
      </summary>

      <div
        style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 8px)",
          zIndex: 50,
          width: 320,
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: 2,
          padding: "20px 24px",
          boxShadow: "0 16px 48px -12px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 16 }}>
          How this is calculated
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 24px", fontSize: 12, color: "var(--color-muted-foreground)", marginBottom: 16 }}>
          <span>Displayed score</span>
          <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{displayedScore.toFixed(1)}</span>
          <span>Confidence</span>
          <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{confidence.toFixed(2)}</span>
          <span>Reviews (total)</span>
          <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{totalReviews}</span>
          <span>Reviews (counted)</span>
          <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{effectiveReviews}</span>
          <span>Prior pull</span>
          <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{priorPull.toFixed(2)}</span>
        </div>

        {topContributors.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 8 }}>
              Top reviewers by weight
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {topContributors.map((c, i) => (
                <div key={`${c.reviewerDisplayName}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12, color: "var(--color-muted-foreground)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.reviewerDisplayName} · {c.score}/10 · {c.visitedOn}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", flexShrink: 0 }}>{c.weightContribution.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: 8 }}>
            Recency
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11, color: "var(--color-muted-foreground)" }}>
            <div>
              <div>Last 6 mo.</div>
              <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{formatPct(recencyProfile.last6Months)}</div>
            </div>
            <div>
              <div>6–18 mo.</div>
              <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{formatPct(recencyProfile.sixTo18Months)}</div>
            </div>
            <div>
              <div>Older</div>
              <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-foreground)", fontWeight: 600 }}>{formatPct(recencyProfile.older)}</div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--color-muted-foreground)", lineHeight: 1.6 }}>
          Ratings are weighted by reviewer status, tenure, consistency, recency, and completeness, then blended with a Bayesian prior.
        </p>
      </div>
    </details>
  );
}
