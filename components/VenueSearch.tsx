"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type VenueResult = {
  id: string;
  name: string;
  city: string;
  slug: string;
};

export function VenueSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient());

  // Query from the first character, 150 ms debounce to avoid hammering on
  // fast typing without feeling sluggish.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
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
      setOpen(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Close when clicking outside the component.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 34,
          padding: "0 10px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          background: "var(--color-background)",
          width: 180,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, color: "var(--color-muted-foreground)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && clear()}
          placeholder="Search venues…"
          aria-label="Search venues"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: "var(--color-foreground)",
            fontFamily: "var(--font-sans)",
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            style={{
              display: "flex",
              alignItems: "center",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--color-muted-foreground)",
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          role="listbox"
          aria-label="Venue results"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 260,
            background: "var(--color-background)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.18)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--color-muted-foreground)",
              }}
            >
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--color-muted-foreground)",
              }}
            >
              No venues found.
            </div>
          ) : (
            results.map((v, i) => (
              <Link
                key={v.id}
                href={`/venues/${v.slug}`}
                onClick={clear}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 14px",
                  textDecoration: "none",
                  color: "var(--color-foreground)",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                  borderTop: i > 0 ? "1px solid var(--color-border)" : "none",
                  background: "transparent",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--color-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-muted-foreground)",
                    flexShrink: 0,
                  }}
                >
                  {v.city}
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
