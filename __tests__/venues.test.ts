import { describe, expect, it } from "vitest";

import { formatRating } from "@/lib/venues";

describe("formatRating", () => {
  it("formats a number to one decimal place", () => {
    expect(formatRating(8.266)).toBe("8.3");
    expect(formatRating(9)).toBe("9.0");
  });

  it("renders an em dash for null", () => {
    expect(formatRating(null)).toBe("—");
  });
});
