"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const CITY_COOKIE = "caffiends_city";

type Region = { id: string; name: string };

type Props = {
  regions: Region[];
  activeRegion: string | null;
  nearActive?: boolean;
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
 * clears it. "Near me" uses browser geolocation and sorts by distance instead
 * of filtering by region.
 */
export function CityChips({ regions, activeRegion, nearActive = false }: Props) {
  const router = useRouter();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);

  // The chip row scrolls horizontally; make sure the selected region is
  // visible when landing with a filter applied.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({
      inline: "center",
      block: "nearest",
    });
  }, [activeRegion]);

  if (regions.length === 0) return null;

  const nearMe = () => {
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    setGeoError(false);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        rememberCity(null);
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        router.push(`/?near=${lat},${lng}`);
      },
      () => {
        setLocating(false);
        setGeoError(true);
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  };

  return (
    <div>
      <nav className="city-chips" aria-label="Filter rankings by region">
        <button
          type="button"
          className="city-chip"
          data-active={nearActive}
          onClick={nearMe}
          disabled={locating}
          style={{ background: "none", cursor: "pointer" }}
        >
          {locating ? "Locating…" : "◎ Near me"}
        </button>
        <Link
          href="/"
          className="city-chip"
          data-active={activeRegion === null && !nearActive}
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
      {geoError ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--color-muted-foreground)",
          }}
        >
          Couldn&rsquo;t get your location — check browser permissions, or pick
          a city instead.
        </p>
      ) : null}
    </div>
  );
}
