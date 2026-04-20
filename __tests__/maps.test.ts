import { describe, expect, it } from "vitest";

import { buildDirectionsUrl, toVenueMapPins } from "@/lib/maps/venues";

describe("toVenueMapPins", () => {
  it("filters out venues without coordinates", () => {
    const pins = toVenueMapPins([
      {
        id: "1",
        slug: "with-coords",
        name: "With Coords",
        city: "Leeds",
        postcode: "LS1 1AA",
        latitude: 53.8,
        longitude: -1.55,
      },
      {
        id: "2",
        slug: "missing-coords",
        name: "Missing Coords",
        city: "Leeds",
        postcode: "LS1 2BB",
        latitude: null,
        longitude: null,
      },
    ]);

    expect(pins).toEqual([
      {
        id: "1",
        slug: "with-coords",
        name: "With Coords",
        city: "Leeds",
        postcode: "LS1 1AA",
        latitude: 53.8,
        longitude: -1.55,
      },
    ]);
  });
});

describe("buildDirectionsUrl", () => {
  it("builds an external directions URL with coordinates", () => {
    const url = buildDirectionsUrl({
      id: "1",
      slug: "x",
      name: "X",
      city: "London",
      postcode: "EC1N 7TE",
      latitude: 51.52,
      longitude: -0.11,
    });

    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("api=1");
    expect(url).toContain("destination=51.52%2C-0.11");
  });
});
