import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { geocodeUkPostcode } from "@/lib/geocoding/google";

describe("geocodeUkPostcode", () => {
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it("returns coordinates when Google responds OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [{ geometry: { location: { lat: 51.5, lng: -0.12 } } }],
        }),
      }),
    );

    const result = await geocodeUkPostcode("EC1N 7TE");

    expect(result).toEqual({
      status: "ok",
      result: { latitude: 51.5, longitude: -0.12 },
    });
  });

  it("maps ZERO_RESULTS to not_found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ZERO_RESULTS", results: [] }),
      }),
    );

    await expect(geocodeUkPostcode("ZZ99 9ZZ")).resolves.toEqual({
      status: "not_found",
    });
  });

  it("maps OVER_QUERY_LIMIT to quota_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "OVER_QUERY_LIMIT",
          error_message: "limit reached",
        }),
      }),
    );

    await expect(geocodeUkPostcode("EC1N 7TE")).resolves.toEqual({
      status: "quota_limited",
      message: "limit reached",
    });
  });

  it("returns error when GOOGLE_MAPS_API_KEY is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    await expect(geocodeUkPostcode("EC1N 7TE")).resolves.toEqual({
      status: "error",
      message: "Missing GOOGLE_MAPS_API_KEY",
    });
  });
});
