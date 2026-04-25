import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/scoring/pipeline", () => ({ runFullPipeline: vi.fn() }));
vi.mock("@/utils/supabase/service", () => ({
  createServiceRoleClient: vi.fn(() => ({})),
}));

const SECRET = "test-secret-abc";

async function callRoute(authHeader?: string) {
  // Import after mocks are set up; reset module cache between tests via vi.resetModules().
  const { POST } = await import("@/app/api/scoring/run/route");
  const request = new Request("http://localhost/api/scoring/run", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
  return POST(request);
}

describe("POST /api/scoring/run — error handling", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SCORING_CRON_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SCORING_CRON_SECRET;
    vi.clearAllMocks();
  });

  it("returns 401 with only {error:'unauthorized'} for bad token", async () => {
    const res = await callRoute("Bearer wrong");
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("returns 500 with only {error:'unauthorized'} when secret is missing", async () => {
    delete process.env.SCORING_CRON_SECRET;
    const res = await callRoute(`Bearer ${SECRET}`);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
    // Must not expose env var name or any config details
    expect(JSON.stringify(body)).not.toContain("SCORING_CRON_SECRET");
  });

  it("returns generic error without stack when pipeline throws an Error", async () => {
    const { runFullPipeline } = await import("@/lib/scoring/pipeline");
    vi.mocked(runFullPipeline).mockRejectedValue(
      new Error("connection refused — postgres:5432"),
    );

    const res = await callRoute(`Bearer ${SECRET}`);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
    expect(body).toHaveProperty("requestId");
    // No stack trace or raw message exposed to caller
    expect(body).not.toHaveProperty("stack");
    expect(body).not.toHaveProperty("message");
    expect(JSON.stringify(body)).not.toContain("postgres");
  });

  it("returns generic error without raw PostgrestError fields", async () => {
    const { runFullPipeline } = await import("@/lib/scoring/pipeline");
    vi.mocked(runFullPipeline).mockRejectedValue({
      message: "row-level security violation",
      code: "42501",
      details: "sensitive schema details",
      hint: "check RLS policies",
    });

    const res = await callRoute(`Bearer ${SECRET}`);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("details");
    expect(body).not.toHaveProperty("hint");
    expect(body).not.toHaveProperty("message");
    expect(JSON.stringify(body)).not.toContain("row-level security");
  });

  it("requestId in error response is a valid UUID v4", async () => {
    const { runFullPipeline } = await import("@/lib/scoring/pipeline");
    vi.mocked(runFullPipeline).mockRejectedValue(new Error("boom"));

    const res = await callRoute(`Bearer ${SECRET}`);
    const body = await res.json();

    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
