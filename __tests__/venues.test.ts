import { describe, expect, it } from "vitest";

import { buildCityFilterOptions, formatRating } from "@/lib/venues";

describe("formatRating", () => {
  it("formats a number to one decimal place", () => {
    expect(formatRating(8.266)).toBe("8.3");
    expect(formatRating(9)).toBe("9.0");
  });

  it("renders an em dash for null", () => {
    expect(formatRating(null)).toBe("—");
  });
});

describe("buildCityFilterOptions", () => {
  it("deduplicates, trims, and sorts city names", () => {
    expect(
      buildCityFilterOptions([
        "Leeds",
        " London ",
        "Leeds",
        "",
        null,
        undefined,
      ]),
    ).toEqual(["Leeds", "London"]);
  });
});
