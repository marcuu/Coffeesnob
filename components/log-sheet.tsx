"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

export type RecentVenue = { slug: string; name: string; city: string };

type VenueResult = { id: string; name: string; city: string; slug: string };

/**
 * Full-screen capture sheet: search any venue (or pick a recent one) and go
 * straight into its review flow. Opened from the bottom nav's Log action —
 * pocket to bucket-selector in two taps.
 */
export function LogSheet({
  recentVenues,
  onClose,
}: {
  recentVenues: RecentVenue[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useRef(createClient());

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.current
        .from("venues")
        .select("id, name, city, slug")
        .ilike("name", `%${q}%`)
        .order("name")
        .limit(8);
      setResults(data ?? []);
      setLoading(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const go = (slug: string) => {
    onClose();
    router.push(`/venues/${slug}/review`);
  };

  const showRecent = !query.trim() && recentVenues.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log a coffee"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "var(--color-background)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px clamp(16px, 4vw, 36px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            letterSpacing: "-0.01em",
          }}
        >
          Log a coffee
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            ...MONO,
            minHeight: 44,
            minWidth: 44,
            background: "none",
            border: "none",
            color: "var(--color-muted-foreground)",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px clamp(16px, 4vw, 36px) 40px",
          maxWidth: 560,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search venues…"
          aria-label="Search venues"
          style={{
            width: "100%",
            height: 48,
            padding: "0 16px",
            border: "1px solid var(--color-border)",
            borderRadius: 2,
            background: "transparent",
            color: "var(--color-foreground)",
            fontSize: 16,
            fontFamily: "var(--font-sans)",
            outline: "none",
          }}
        />

        {showRecent ? (
          <section style={{ marginTop: 28 }}>
            <div
              style={{
                ...MONO,
                color: "var(--color-muted-foreground)",
                marginBottom: 12,
              }}
            >
              Your recent venues
            </div>
            <VenueRows
              venues={recentVenues.map((v) => ({ ...v, id: v.slug }))}
              onPick={go}
            />
          </section>
        ) : null}

        {query.trim() ? (
          <section style={{ marginTop: 28 }}>
            {loading ? (
              <p style={{ fontSize: 14, color: "var(--color-muted-foreground)" }}>
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--color-muted-foreground)" }}>
                No venues match &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <VenueRows venues={results} onPick={go} />
            )}
          </section>
        ) : null}

        <p style={{ marginTop: 32, fontSize: 13, color: "var(--color-muted-foreground)" }}>
          Can&rsquo;t find it?{" "}
          <Link
            href="/venues/new"
            onClick={onClose}
            style={{ color: "var(--color-foreground)", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Add the venue
          </Link>{" "}
          and review it first.
        </p>
      </div>
    </div>
  );
}

function VenueRows({
  venues,
  onPick,
}: {
  venues: Array<{ id: string; slug: string; name: string; city: string }>;
  onPick: (slug: string) => void;
}) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {venues.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            onClick={() => onPick(v.slug)}
            className="lb-row"
            style={{
              width: "100%",
              alignItems: "center",
              background: "none",
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <span style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--color-foreground)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {v.name}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  color: "var(--color-muted-foreground)",
                }}
              >
                {v.city}
              </span>
            </span>
            <span style={{ ...MONO, flexShrink: 0, color: "var(--color-accent)" }}>
              Log →
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
