import Link from "next/link";

import { formatRelativeDate } from "@/lib/profile";

export type ActivityReview = {
  id: string;
  rating_overall: number;
  rating_coffee_5: number;
  rating_vibe_5: number;
  body: string;
  visited_on: string;
  venue: {
    name: string;
    slug: string;
    city: string;
  };
};

function RatingPill({ value, label }: { value: number; label: string }) {
  return (
    <span style={{ color: "var(--color-muted-foreground)" }}>
      {label} {value}/5
    </span>
  );
}

type Props = {
  reviews: ActivityReview[];
};

export function ActivityFeed({ reviews }: Props) {
  if (reviews.length === 0) {
    return (
      <section style={{ marginBottom: 36 }}>
        <h2
          style={{
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-muted-foreground)",
            marginBottom: 12,
          }}
        >
          Recent reviews
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-muted-foreground)" }}>
          No reviews yet.
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 13,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-muted-foreground)",
          marginBottom: 12,
        }}
      >
        Recent reviews
      </h2>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 12,
        }}
      >
        {reviews.map((r) => (
          <li
            key={r.id}
            style={{
              padding: "16px 18px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-background)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <Link
                href={`/venues/${r.venue.slug}`}
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--color-foreground)",
                  textDecoration: "none",
                }}
              >
                {r.venue.name}
              </Link>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--color-foreground)",
                  flexShrink: 0,
                }}
              >
                {r.rating_overall}/10
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "var(--color-muted-foreground)",
                fontFamily: "var(--font-mono)",
                marginBottom: 8,
              }}
            >
              <span>{r.venue.city}</span>
              <span>·</span>
              <span>visited {formatRelativeDate(r.visited_on)}</span>
            </div>

            {r.body && (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-foreground)",
                  lineHeight: 1.5,
                  marginBottom: 10,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {r.body}
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0 14px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            >
              <RatingPill value={r.rating_coffee_5} label="Coffee" />
              <RatingPill value={r.rating_vibe_5} label="Vibe" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
