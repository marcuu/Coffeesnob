import { describe, expect, it } from "vitest";

import { sanitizeNext } from "@/lib/sanitize-next";

describe("sanitizeNext — open-redirect prevention", () => {
  it.each([
    ["/", "/"],
    ["/venues", "/venues"],
    ["/venues/prufrock-coffee", "/venues/prufrock-coffee"],
    ["/profile/edit", "/profile/edit"],
    // Colons in path/query segments are benign: origin is always prepended,
    // making the final URL https://host/... regardless of path content.
    ["/search?q=time:10", "/search?q=time:10"],
    ["/venues/cafe:espresso", "/venues/cafe:espresso"],
  ])("allows safe relative path %s", (input, expected) => {
    expect(sanitizeNext(input)).toBe(expected);
  });

  it.each([
    // Protocol-relative
    ["//evil.com", "/"],
    ["//evil.com/path", "/"],
    // Absolute URLs
    ["https://evil.com", "/"],
    ["http://evil.com", "/"],
    // Encoded protocol-relative
    ["%2F%2Fevil.com", "/"],
    // Encoded absolute URL
    ["https%3A%2F%2Fevil.com", "/"],
    // Backslash tricks
    ["/\\evil.com", "/"],
    // Non-slash start
    ["evil.com", "/"],
    ["javascript:alert(1)", "/"],
    // Malformed percent encoding
    ["%ZZ", "/"],
  ])("rejects unsafe value %s → /", (input, expected) => {
    expect(sanitizeNext(input)).toBe(expected);
  });

  it("falls back to / for empty string", () => {
    // Empty string doesn't start with /
    expect(sanitizeNext("")).toBe("/");
  });
});
