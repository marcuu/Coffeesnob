import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Leaderboard } from "@/app/onboarding/leaderboard";
import type { OnboardingVenue } from "@/app/onboarding/data";

// next/navigation is not available in jsdom; mock it so the module resolves.
vi.mock("next/navigation", () => ({ permanentRedirect: vi.fn() }));

const venue1: OnboardingVenue = {
  slug: "prufrock-coffee",
  name: "Prufrock",
  city: "London",
  area: "london",
  roaster: "Square Mile",
  axes: { fruit: 0.9, floral: 0.5 },
  drinks: ["filter", "espresso"],
  score: 8.5,
  reviews: 42,
  pitch: "Filter bar on Leather Lane.",
  proof: "42 reviews, weighted score 8.5.",
};

const venue2: OnboardingVenue = {
  slug: "north-star-leeds",
  name: "North Star",
  city: "Leeds",
  area: "leeds",
  roaster: "North Star",
  axes: { choc: 0.8, nutty: 0.7 },
  drinks: ["milky", "espresso"],
  score: 7.9,
  reviews: 31,
  pitch: "Best cortado in Leeds.",
  proof: "31 reviews, weighted score 7.9.",
};

describe("Leaderboard (logged-out landing page)", () => {
  it("renders the top venue and subsequent venues", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(screen.getByText("Prufrock")).toBeInTheDocument();
    expect(screen.getByText("North Star")).toBeInTheDocument();
  });

  it("does not render a sidebar", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(screen.queryByText("Tune your feed")).not.toBeInTheDocument();
    expect(screen.queryByText("Three quick things.")).not.toBeInTheDocument();
  });

  it("does not render the aha reveal modal", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(screen.queryByText(/go here first/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/based on what you told us/i)).not.toBeInTheDocument();
  });

  it("does not render the Tune feed button", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(screen.queryByText(/tune feed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/edit taste/i)).not.toBeInTheDocument();
  });

  it("does not render the floating personalisation nudge", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(
      screen.queryByText(/want better matches/i),
    ).not.toBeInTheDocument();
  });

  it("renders the 'Sign in to personalise' CTA", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(
      screen.getByRole("link", { name: /sign in to personalise/i }),
    ).toBeInTheDocument();
  });

  it("'Sign in to personalise' links to /login", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    const link = screen.getByRole("link", { name: /sign in to personalise/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders the 'Browse venues' link", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(
      screen.getByRole("link", { name: /browse venues/i }),
    ).toBeInTheDocument();
  });

  it("renders leaderboard framing copy, not onboarding framing", () => {
    render(<Leaderboard venues={[venue1, venue2]} />);
    expect(
      screen.getByText(/third-wave coffee, reviewed honestly/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/your shortlist/i),
    ).not.toBeInTheDocument();
  });

  it("shows the empty-state with a sign-in link when there are no venues", () => {
    render(<Leaderboard venues={[]} />);
    expect(screen.getByText(/no venues yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
