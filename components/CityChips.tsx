"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export const CITY_COOKIE = "caffiends_city";

type Region = { id: string; name: string };

type Props = {
  regions: Region[];
  activeRegion: string | null;
};

function rememberCity(id: string | null) {
  if (id) {
    document.cookie = `${CITY_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
  } else {
    document.cookie = `${CITY_COOKIE}=; path=/; max-age=0`;
  }
}

/**
 * Horizontal scrollable region filter. The chosen region is remembered in a
 * cookie so the leaderboard reopens on the visitor's city next time; "All UK"
 * clears it.
 */
export function CityChips({ regions, activeRegion }: Props) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  // The chip row scrolls horizontally; make sure the selected region is
  // visible when landing with a filter applied.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({
      inline: "center",
      block: "nearest",
    });
  }, [activeRegion]);

  if (regions.length === 0) return null;

  return (
    <nav className="city-chips" aria-label="Filter rankings by region">
      <Link
        href="/"
        className="city-chip"
        data-active={activeRegion === null}
        onClick={() => rememberCity(null)}
      >
        All UK
      </Link>
      {regions.map((r) => (
        <Link
          key={r.id}
          ref={activeRegion === r.id ? activeRef : undefined}
          href={`/?city=${encodeURIComponent(r.id)}`}
          className="city-chip"
          data-active={activeRegion === r.id}
          onClick={() => rememberCity(r.id)}
        >
          {r.name}
        </Link>
      ))}
    </nav>
  );
}
