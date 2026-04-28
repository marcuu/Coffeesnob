import type { BucketCounts } from "@/app/profile/_lib/fetch-profile";

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

export function BucketDistribution({ counts }: { counts: BucketCounts }) {
  const total = counts.pilgrimage + counts.detour + counts.convenience;
  if (total === 0) return null;

  // Lead with detour count when the user has very few pilgrimages, so the
  // empty-state doesn't dominate.
  const sequence =
    counts.pilgrimage < 3
      ? [ORDER[1], ORDER[0], ORDER[2]]
      : ORDER;

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ ...MONO, color: "var(--color-muted-foreground)", marginBottom: 10 }}>
        Bucket distribution
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
    </section>
  );
}
