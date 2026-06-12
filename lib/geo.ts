/** Great-circle distance in miles between two WGS84 points. */
export function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.761; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistanceMiles(mi: number): string {
  if (mi < 0.1) return "nearby";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

/** Parses a "lat,lng" search param; null when malformed or out of range. */
export function parseLatLng(
  value: string | undefined,
): { lat: number; lng: number } | null {
  if (!value) return null;
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

type PostcodesIoResult = {
  status: number;
  result: { latitude: number; longitude: number } | null;
};

/**
 * Best-effort UK postcode geocoding via postcodes.io (free, no key).
 * Returns null on any failure — callers must treat coordinates as optional.
 */
export async function geocodePostcode(
  postcode: string,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as PostcodesIoResult;
    if (!json.result) return null;
    return {
      latitude: json.result.latitude,
      longitude: json.result.longitude,
    };
  } catch {
    return null;
  }
}
