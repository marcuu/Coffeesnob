import type { TasteProfile as TasteProfileData } from "@/lib/profile";

type Props = {
  profile: TasteProfileData;
};

export function TasteProfile({ profile }: Props) {
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
        Taste profile
      </h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 10,
        }}
      >
        {profile.chips.map((chip) => (
          <span
            key={chip}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              border: "1px solid var(--color-border)",
              background: "var(--color-muted)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-foreground)",
            }}
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
}
