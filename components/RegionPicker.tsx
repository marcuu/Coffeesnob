"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Region = { id: string; name: string };

type Props = {
  regions: Region[];
};

export function RegionPicker({ regions }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (regions.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
      >
        Browse by region
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: "transform 150ms",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-44 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] shadow-lg">
          {regions.map((r, i) => (
            <Link
              key={r.id}
              href={`/rankings/${r.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-2.5 text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              style={{
                borderTop: i > 0 ? "1px solid var(--color-border)" : "none",
              }}
            >
              {r.name}
              <span className="text-[var(--color-muted-foreground)]">→</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
