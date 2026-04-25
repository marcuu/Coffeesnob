import { describe, expect, it, vi } from "vitest";

// Mock supabase so the route module can be imported without real credentials.
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

import { sanitizeNext } from "@/app/auth/callback/route";

describe("sanitizeNext — open-redirect prevention", () => {
  it.each([
    ["/", "/"],
    ["/venues", "/venues"],
    ["/venues/prufrock-coffee", "/venues/prufrock-coffee"],
    ["/profile/edit", "/profile/edit"],
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
