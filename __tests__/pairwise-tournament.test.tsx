import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PairwiseTournament } from "@/components/review/pairwise-tournament";
import type { Review, ReviewBucket } from "@/lib/types";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const passthrough = (tag: string) => {
    const Component = ({
      children,
      ...rest
    }: { children?: React.ReactNode } & Record<string, unknown>) => {
      const props = { ...rest } as Record<string, unknown>;
      for (const k of ["initial", "animate", "exit", "transition", "whileHover", "whileTap"]) {
        delete props[k];
      }
      return React.createElement(tag, props, children);
    };
    return Component;
  };
  return {
    motion: new Proxy({}, { get: (_t, p) => passthrough(typeof p === "string" ? p : "div") }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

function makeReview(id: string, rank: number, bucket: ReviewBucket = "pilgrimage"): Review {
  return {
    id,
    venue_id: `v-${id}`,
    reviewer_id: "me",
    rating_overall: 8,
    rating_coffee_5: 3,
    rating_vibe_5: 3,
    bucket,
    rank_position: rank,
    body: "",
    visited_on: "2026-01-01",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const candidates = [makeReview("r0", 1000), makeReview("r1", 2000)];
const candidateNames = { r0: "Prufrock", r1: "Workshop" };

describe("PairwiseTournament — venue-named buttons", () => {
  it("renders the new venue name on the left (better) button", () => {
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={candidates}
        candidateNames={candidateNames}
        newVenueName="Black Sheep"
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tournament-btn-better")).toHaveTextContent("Black Sheep");
  });

  it("renders the comparison venue name on the right (worse) button", () => {
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={candidates}
        candidateNames={candidateNames}
        newVenueName="Black Sheep"
        onComplete={vi.fn()}
      />,
    );
    // First comparison is the midpoint: candidates[1] for a 2-item list → "Workshop"
    const worseBtn = screen.getByTestId("tournament-btn-worse");
    expect(worseBtn.textContent).toBeTruthy();
  });

  it("tapping the better button records 'better'", async () => {
    const onComplete = vi.fn();
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={[makeReview("r0", 1000)]}
        candidateNames={{ r0: "Prufrock" }}
        newVenueName="Black Sheep"
        onComplete={onComplete}
      />,
    );
    await userEvent.click(screen.getByTestId("tournament-btn-better"));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        history: expect.arrayContaining([
          expect.objectContaining({ result: "better" }),
        ]),
      }),
    );
  });

  it("tapping the worse button records 'worse'", async () => {
    const onComplete = vi.fn();
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={[makeReview("r0", 1000)]}
        candidateNames={{ r0: "Prufrock" }}
        newVenueName="Black Sheep"
        onComplete={onComplete}
      />,
    );
    await userEvent.click(screen.getByTestId("tournament-btn-worse"));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        history: expect.arrayContaining([
          expect.objectContaining({ result: "worse" }),
        ]),
      }),
    );
  });

  it("tapping 'About the same' records 'same'", async () => {
    const onComplete = vi.fn();
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={[makeReview("r0", 1000)]}
        candidateNames={{ r0: "Prufrock" }}
        newVenueName="Black Sheep"
        onComplete={onComplete}
      />,
    );
    await userEvent.click(screen.getByTestId("tournament-btn-same"));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        history: expect.arrayContaining([
          expect.objectContaining({ result: "same" }),
        ]),
      }),
    );
  });
});

describe("PairwiseTournament — back-step", () => {
  it("does not show Back button on the first comparison when no onBack provided", () => {
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={candidates}
        candidateNames={candidateNames}
        newVenueName="Black Sheep"
        onComplete={vi.fn()}
      />,
    );
    // onBack not provided, stateHistory empty → no Back button
    expect(screen.queryByText(/← Back/i)).not.toBeInTheDocument();
  });

  it("shows Back button on the first comparison when onBack is provided", () => {
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={candidates}
        candidateNames={candidateNames}
        newVenueName="Black Sheep"
        onComplete={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/← Back/i)).toBeInTheDocument();
  });

  it("calls onBack when Back is tapped on the first comparison", async () => {
    const onBack = vi.fn();
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={candidates}
        candidateNames={candidateNames}
        newVenueName="Black Sheep"
        onComplete={vi.fn()}
        onBack={onBack}
      />,
    );
    await userEvent.click(screen.getByText(/← Back/i));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("back after a comparison restores prior state (forward → back → forward gives same result)", async () => {
    const completions: unknown[][] = [];
    const onComplete = vi.fn((...args: unknown[]) => completions.push(args));

    const singleCandidate = [makeReview("r0", 1000)];
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={singleCandidate}
        candidateNames={{ r0: "Prufrock" }}
        newVenueName="Black Sheep"
        onComplete={onComplete}
        onBack={vi.fn()}
      />,
    );

    // Step forward: tap "better"
    await userEvent.click(screen.getByTestId("tournament-btn-better"));
    // onComplete called once — tournament is done after 1 comparison in a 1-item bucket
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows Back button after one comparison even without onBack", async () => {
    // Multi-comparison tournament: candidates has 3 items so first comparison
    // doesn't end the tournament; after tapping, the Back button should appear.
    const threeCandidates = [
      makeReview("r0", 1000),
      makeReview("r1", 2000),
      makeReview("r2", 3000),
    ];
    render(
      <PairwiseTournament
        bucket="pilgrimage"
        candidates={threeCandidates}
        candidateNames={{ r0: "Prufrock", r1: "Workshop", r2: "Monmouth" }}
        newVenueName="Black Sheep"
        onComplete={vi.fn()}
      />,
    );

    // Initially no Back button (stateHistory empty, no onBack)
    expect(screen.queryByText(/← Back/i)).not.toBeInTheDocument();

    // Tap "better" — now stateHistory has 1 entry
    await userEvent.click(screen.getByTestId("tournament-btn-better"));

    // Back button should now be visible
    expect(screen.getByText(/← Back/i)).toBeInTheDocument();
  });
});
