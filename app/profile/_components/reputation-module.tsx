import type { ReputationTier } from "@/lib/profile";

type Props = {
  reputation: ReputationTier;
};

export function ReputationModule({ reputation }: Props) {
  return (
    <section
      style={{
        padding: "20px 22px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-muted)",
        marginBottom: 36,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-muted-foreground)",
            margin: 0,
          }}
        >
          Reputation
        </h2>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            color: "var(--color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "2px 8px",
            borderRadius: 999,
            background: "var(--color-accent-soft)",
            border: "1px solid var(--color-accent-ring)",
            flexShrink: 0,
          }}
        >
          {reputation.label}
        </span>
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--color-foreground)",
          lineHeight: 1.5,
          marginBottom: reputation.nextStep ? 10 : 0,
        }}
      >
        {reputation.description}
      </p>

      {reputation.nextStep && (
        <p
          style={{
            fontSize: 12,
            color: "var(--color-muted-foreground)",
            fontFamily: "var(--font-mono)",
            borderTop: "1px solid var(--color-border)",
            paddingTop: 10,
            marginTop: 10,
          }}
        >
          Next: {reputation.nextStep}
        </p>
      )}
    </section>
  );
}
