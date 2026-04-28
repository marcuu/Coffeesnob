import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewForm } from "@/app/venues/[slug]/review/review-form";

vi.mock("@/app/venues/[slug]/review/actions", () => ({
  submitRankedReview: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  // Stub framer-motion so the test doesn't require the runtime; we only need
  // the JSX to render.
  const passthrough = (tag: string) => {
    const Component = ({
      children,
      ...rest
    }: { children?: React.ReactNode } & Record<string, unknown>) => {
      const props = { ...rest } as Record<string, unknown>;
      // strip motion-only props that React would warn about
      for (const k of [
        "initial",
        "animate",
        "exit",
        "transition",
        "whileHover",
        "whileTap",
      ]) {
        delete props[k];
      }
      return React.createElement(tag, props, children);
    };
    return Component;
  };
  // Lazy import React inside the factory so the mock body has access to it.
  const React = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, p) => passthrough(typeof p === "string" ? p : "div"),
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

describe("ReviewForm", () => {
  it("opens on the bucket-selector step with all three options", () => {
    render(
      <ReviewForm
        venueId="venue-1"
        slug="test-venue"
        venueName="Workshop"
        reviewsByBucket={{ pilgrimage: [], detour: [], convenience: [] }}
        candidateNamesByReviewId={{}}
      />,
    );

    expect(screen.getByText(/PILGRIMAGE/i)).toBeInTheDocument();
    expect(screen.getByText(/DETOUR/i)).toBeInTheDocument();
    expect(screen.getByText(/CONVENIENCE/i)).toBeInTheDocument();
    expect(
      screen.getByText(/How does Workshop stack up\?/i),
    ).toBeInTheDocument();
  });
});
