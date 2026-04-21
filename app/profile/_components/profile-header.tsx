import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Reviewer } from "@/lib/types";

const TIER_LABELS: Record<Reviewer["status"], string> = {
  beaned: "Trusted contributor",
  invited: "Invited reviewer",
  active: "Reviewer",
};

function AvatarFallback({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "var(--color-accent-soft)",
        border: "1px solid var(--color-accent-ring)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-serif)",
        fontSize: 22,
        fontWeight: 500,
        color: "var(--color-accent)",
        flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}

type Props = {
  reviewer: Reviewer;
  isOwnProfile: boolean;
};

export function ProfileHeader({ reviewer, isOwnProfile }: Props) {
  const tierLabel = TIER_LABELS[reviewer.status] ?? "Reviewer";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
        marginBottom: 32,
      }}
    >
      {reviewer.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reviewer.avatar_url}
          alt=""
          width={64}
          height={64}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
            border: "1px solid var(--color-border)",
          }}
        />
      ) : (
        <AvatarFallback name={reviewer.display_name} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {reviewer.display_name}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 2,
                flexWrap: "wrap",
              }}
            >
              {reviewer.username && (
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--color-muted-foreground)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  @{reviewer.username}
                </span>
              )}
              {reviewer.home_city && (
                <>
                  {reviewer.username && (
                    <span
                      style={{
                        color: "var(--color-border)",
                        fontSize: 12,
                      }}
                    >
                      ·
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--color-muted-foreground)",
                    }}
                  >
                    {reviewer.home_city}
                  </span>
                </>
              )}
            </div>
          </div>

          {isOwnProfile && (
            <Button asChild variant="outline" size="sm">
              <Link href="/profile/edit">Edit profile</Link>
            </Button>
          )}
        </div>

        {reviewer.bio && (
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--color-foreground)",
              maxWidth: 480,
            }}
          >
            {reviewer.bio}
          </p>
        )}

        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--color-accent-soft)",
            border: "1px solid var(--color-accent-ring)",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "var(--color-accent)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-accent)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {tierLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
