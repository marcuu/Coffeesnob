const GOOGLE_GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};

export type GeocodeResponse =
  | { status: "ok"; result: GeocodeResult }
  | { status: "not_found" }
  | { status: "quota_limited"; message?: string }
  | { status: "error"; message: string };

function normaliseUkPostcode(postcode: string): string {
  return postcode.replace(/\s+/g, " ").trim().toUpperCase();
}

type GoogleGeocodePayload = {
  status: string;
  error_message?: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

export async function geocodeUkPostcode(postcode: string): Promise<GeocodeResponse> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      status: "error",
      message: "Missing GOOGLE_MAPS_API_KEY",
    };
  }

  const formatted = normaliseUkPostcode(postcode);
  const address = `${formatted}, UK`;
  const url = new URL(GOOGLE_GEOCODE_ENDPOINT);
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "uk");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      status: "error",
      message: `Google Geocoding HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as GoogleGeocodePayload;
  const googleStatus = payload.status;

  if (googleStatus === "OVER_DAILY_LIMIT" || googleStatus === "OVER_QUERY_LIMIT") {
    return { status: "quota_limited", message: payload.error_message };
  }

  if (googleStatus === "ZERO_RESULTS") {
    return { status: "not_found" };
  }

  if (googleStatus !== "OK") {
    return {
      status: "error",
      message: payload.error_message ?? `Google Geocoding status ${googleStatus}`,
    };
  }

  const location = payload.results?.[0]?.geometry?.location;
  if (
    !location ||
    typeof location.lat !== "number" ||
    typeof location.lng !== "number"
  ) {
    return {
      status: "error",
      message: "Google Geocoding returned no usable coordinates",
    };
  }

  return {
    status: "ok",
    result: {
      latitude: location.lat,
      longitude: location.lng,
    },
  };
}
