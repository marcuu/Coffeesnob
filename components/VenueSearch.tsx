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
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useRef(createClient());

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

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        collapse();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function expand() {
    setExpanded(true);
    // Focus on next tick so the input is visible before focusing
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function collapse() {
    setExpanded(false);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 34,
          border: expanded ? "1px solid var(--color-border)" : "none",
          borderRadius: "var(--radius)",
          background: expanded ? "var(--color-background)" : "transparent",
          overflow: "hidden",
          transition: "width 200ms ease, border-color 200ms ease, background 200ms ease",
          width: expanded ? 180 : 34,
        }}
      >
        <button
          type="button"
          aria-label="Search venues"
          onClick={expand}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 34,
            height: 34,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--color-muted-foreground)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (query) {
                clear();
              } else {
                collapse();
              }
            }
          }}
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
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? "auto" : "none",
            transition: "opacity 150ms ease",
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
              padding: "0 8px 0 0",
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
            right: 0,
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
                onClick={collapse}
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
