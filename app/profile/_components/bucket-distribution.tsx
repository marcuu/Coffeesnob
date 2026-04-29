import type {
  BucketCounts,
  ReviewWithVenue,
} from "@/app/profile/_lib/fetch-profile";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const ORDER: Array<{ key: keyof BucketCounts; label: string }> = [
  { key: "pilgrimage", label: "Pilgrimages" },
  { key: "detour", label: "Detours" },
  { key: "convenience", label: "Convenience" },
];

function avg(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return sum / numbers.length;
}

export function BucketDistribution({
  counts,
  reviews,
}: {
  counts: BucketCounts;
  reviews?: ReviewWithVenue[];
}) {
  const total = counts.pilgrimage + counts.detour + counts.convenience;
  if (total === 0) return null;

  // Lead with detour count when the user has very few pilgrimages, so the
  // empty-state doesn't dominate.
  const sequence =
    counts.pilgrimage < 3
      ? [ORDER[1], ORDER[0], ORDER[2]]
      : ORDER;

  const pilgrimagePercent = Math.round((counts.pilgrimage / total) * 100);

  const pilgrimages = (reviews ?? []).filter((r) => r.bucket === "pilgrimage");
  const avgCoffee = avg(pilgrimages.map((r) => r.rating_coffee_5));
  const avgVibe = avg(pilgrimages.map((r) => r.rating_vibe_5));

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ ...MONO, color: "var(--color-muted-foreground)", marginBottom: 10 }}>
        Bucket distribution
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {sequence.map(({ key, label }) => (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "12px 16px",
              borderRadius: 4,
              border: "1px solid var(--color-border)",
              minWidth: 110,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                color: "var(--color-foreground)",
              }}
            >
              {counts[key]}
            </span>
            <span style={{ ...MONO, color: "var(--color-muted-foreground)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
      {avgCoffee !== null && avgVibe !== null ? (
        <div
          style={{
            ...MONO,
            color: "var(--color-muted-foreground)",
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          Avg pilgrimage: ☕ {avgCoffee.toFixed(1)} · 🪑 {avgVibe.toFixed(1)}
        </div>
      ) : null}
      <p
        style={{
          fontSize: 12,
          fontStyle: "italic",
          color: "var(--color-muted-foreground)",
          lineHeight: 1.6,
          maxWidth: 420,
        }}
      >
        Most snobs only mark 8% of venues as pilgrimages. You&apos;re at{" "}
        {pilgrimagePercent}%.
      </p>
    </section>
  );
}
