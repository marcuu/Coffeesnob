"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildDirectionsUrl,
  type VenueMapPin,
  toVenueMapPins,
  type VenueMapItem,
} from "@/lib/maps/venues";

type VenuesMapProps = {
  venues: VenueMapItem[];
};

const DEFAULT_CENTER = { lat: 54.2, lng: -2.7 };
const DEFAULT_ZOOM = 6;

type GoogleMapsLatLngLiteral = { lat: number; lng: number };
type GoogleMapsMapInstance = {
  fitBounds(bounds: GoogleMapsLatLngBoundsInstance, padding?: number): void;
};
type GoogleMapsLatLngBoundsInstance = {
  extend(latLng: GoogleMapsLatLngLiteral): void;
};
type GoogleMapsMarkerInstance = {
  addListener(eventName: "click", handler: () => void): void;
};
type GoogleMapsNamespace = {
  Map: new (
    element: HTMLElement,
    options: {
      center: GoogleMapsLatLngLiteral;
      zoom: number;
      mapTypeControl: boolean;
      streetViewControl: boolean;
      fullscreenControl: boolean;
    },
  ) => GoogleMapsMapInstance;
  Marker: new (options: {
    map: GoogleMapsMapInstance;
    position: GoogleMapsLatLngLiteral;
    title: string;
  }) => GoogleMapsMarkerInstance;
  LatLngBounds: new () => GoogleMapsLatLngBoundsInstance;
};

type GoogleWindow = Window & {
  google?: { maps?: GoogleMapsNamespace };
};

function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as GoogleWindow).google) {
    return Promise.resolve();
  }

  const existing = document.getElementById("google-maps-script");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps script")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

export function VenuesMap({ venues }: VenuesMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef<HTMLDivElement | null>(null);
  const pins = useMemo(() => toVenueMapPins(venues), [venues]);

  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<VenueMapPin | null>(
    pins.length > 0 ? pins[0] : null,
  );

  useEffect(() => {
    let cancelled = false;

    async function initialiseMap() {
      if (!apiKey) {
        setState("error");
        setError("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
        return;
      }
      if (!mapRef.current) return;

      try {
        await loadGoogleMapsApi(apiKey);
        if (cancelled || !mapRef.current) return;

        const googleObj = (window as GoogleWindow).google;
        if (!googleObj?.maps) {
          throw new Error("Google Maps API unavailable");
        }
        const maps = googleObj.maps;

        const map = new maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        const bounds = new maps.LatLngBounds();

        for (const pin of pins) {
          const marker = new maps.Marker({
            map,
            position: { lat: pin.latitude, lng: pin.longitude },
            title: pin.name,
          });

          marker.addListener("click", () => {
            setSelectedPin(pin);
          });

          bounds.extend({ lat: pin.latitude, lng: pin.longitude });
        }

        if (pins.length > 0) {
          map.fitBounds(bounds, 64);
        }

        setState("ready");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Failed to load map");
      }
    }

    initialiseMap();

    return () => {
      cancelled = true;
    };
  }, [apiKey, pins]);

  if (!apiKey) {
    return (
      <p className="text-sm text-[var(--color-destructive)]">
        Missing map key. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </p>
    );
  }

  return (
    <section className="grid gap-4">
      {pins.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] p-4 text-sm text-[var(--color-muted-foreground)]">
          No geocoded venues yet. Add coordinates by running the geocoding backfill.
        </p>
      ) : null}

      <div className="rounded-lg border border-[var(--color-border)] p-2">
        <div
          ref={mapRef}
          className="h-[460px] w-full rounded-md bg-[var(--color-muted)]"
          aria-label="Venue map"
        />
        {state === "loading" ? (
          <p className="px-2 pt-2 text-xs text-[var(--color-muted-foreground)]">
            Loading map…
          </p>
        ) : null}
        {state === "error" ? (
          <p className="px-2 pt-2 text-xs text-[var(--color-destructive)]">
            Could not load map{error ? `: ${error}` : ""}
          </p>
        ) : null}
      </div>

      {selectedPin ? (
        <div className="rounded-md border border-[var(--color-border)] p-4">
          <h2 className="text-base font-semibold">{selectedPin.name}</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {selectedPin.city} · {selectedPin.postcode}
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/venues/${selectedPin.slug}`}>View venue</Link>
            </Button>
            <Button asChild size="sm">
              <a
                href={buildDirectionsUrl(selectedPin)}
                target="_blank"
                rel="noreferrer"
              >
                Navigate
              </a>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
