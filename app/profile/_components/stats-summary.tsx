import { formatJoinDate } from "@/lib/profile";
import type { Reviewer } from "@/lib/types";

type Stat = {
  label: string;
  value: string | number;
};

type Props = {
  reviewer: Reviewer;
  citiesCount: number;
  streak: number;
};

export function StatsSummary({ reviewer, citiesCount, streak }: Props) {
  const stats: Stat[] = [
    { label: "Reviews", value: reviewer.review_count },
    { label: "Venues", value: reviewer.venues_reviewed_count },
    { label: "Cities", value: citiesCount },
    ...(streak > 0 ? [{ label: "Week streak", value: streak }] : []),
    {
      label: "Member since",
      value: formatJoinDate(reviewer.created_at),
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        marginBottom: 32,
        padding: "16px 0",
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flex: "1 1 auto",
            minWidth: 80,
            padding: "8px 12px",
            ...(i < stats.length - 1
              ? {
                  borderRight: "1px solid var(--color-border)",
                }
              : {}),
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--color-foreground)",
            }}
          >
            {s.value}
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginTop: 2,
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
