import { describe, expect, it } from "vitest";

// Validate that the next.config.ts headers() function returns the required
// security headers. This is a unit test against the config object rather than
// a full HTTP integration test.
import nextConfig from "@/next.config";

describe("next.config.ts security headers", () => {
  it("exports a headers() function", () => {
    expect(typeof nextConfig.headers).toBe("function");
  });

  it("applies headers to all routes via /(.*) source", async () => {
    const rules = await nextConfig.headers!();
    const catchAll = rules.find((r) => r.source === "/(.*)");
    expect(catchAll).toBeDefined();
  });

  it("sets X-Frame-Options: DENY", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const xfo = headers.find((h) => h.key === "X-Frame-Options");
    expect(xfo?.value).toBe("DENY");
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const xcto = headers.find((h) => h.key === "X-Content-Type-Options");
    expect(xcto?.value).toBe("nosniff");
  });

  it("sets Referrer-Policy", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const rp = headers.find((h) => h.key === "Referrer-Policy");
    expect(rp).toBeDefined();
    expect(rp?.value).toBeTruthy();
  });

  it("sets a Content-Security-Policy (report-only or enforcing)", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const hasCsp = headers.some(
      (h) =>
        h.key === "Content-Security-Policy" ||
        h.key === "Content-Security-Policy-Report-Only",
    );
    expect(hasCsp).toBe(true);
  });

  it("CSP includes frame-ancestors 'none'", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules.flatMap((r) => r.headers);
    const csp = headers.find(
      (h) =>
        h.key === "Content-Security-Policy" ||
        h.key === "Content-Security-Policy-Report-Only",
    );
    expect(csp?.value).toContain("frame-ancestors 'none'");
  });
});
