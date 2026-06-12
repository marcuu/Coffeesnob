import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Leaderboard } from "@/components/leaderboard/leaderboard";
import type { RankedVenue, UnrankedVenue } from "@/lib/rankings";
import type { Venue } from "@/lib/types";

// next/navigation is not available in jsdom; mock it so the module resolves.
vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

function makeVenue(overrides: Partial<Venue>): Venue {
  return {
    id: "v-1",
    slug: "prufrock-coffee",
    name: "Prufrock",
    address_line1: "23-25 Leather Ln",
    address_line2: null,
    city: "London",
    postcode: "EC1N 7TE",
    country: "GB",
    latitude: null,
    longitude: null,
    website: null,
    instagram: null,
    roasters: [],
    brew_methods: [],
    has_decaf: null,
    has_plant_milk: true,
    notes: null,
    photo_url: null,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const ranked: RankedVenue[] = [
  {
    venue: makeVenue({ id: "v-1", slug: "prufrock-coffee", name: "Prufrock" }),
    rank: 1,
    score: 8.5,
    reviewCount: 42,
  },
  {
    venue: makeVenue({
      id: "v-2",
      slug: "north-star-leeds",
      name: "North Star",
      city: "Leeds",
    }),
    rank: 2,
    score: 7.9,
    reviewCount: 31,
  },
];

const unranked: UnrankedVenue[] = [
  {
    venue: makeVenue({
      id: "v-3",
      slug: "kaffeine",
      name: "Kaffeine",
    }),
    reviewCount: 0,
  },
];

const regions = [
  { id: "london", name: "London" },
  { id: "leeds", name: "Leeds" },
];

function renderLeaderboard(
  props: Partial<React.ComponentProps<typeof Leaderboard>> = {},
) {
  return render(
    <Leaderboard
      ranked={ranked}
      unranked={unranked}
      regions={regions}
      activeRegion={null}
      {...props}
    />,
  );
}

describe("Leaderboard (canonical home page)", () => {
  it("renders the top venue and subsequent venues", () => {
    renderLeaderboard();
    expect(screen.getByText("Prufrock")).toBeInTheDocument();
    expect(screen.getByText("North Star")).toBeInTheDocument();
  });

  it("renders the 'Sign in to personalise' CTA linking to /login when logged out", () => {
    renderLeaderboard();
    const link = screen.getByRole("link", { name: /sign in to personalise/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders a 'Go to your list' link instead when logged in", () => {
    renderLeaderboard({ isLoggedIn: true });
    expect(
      screen.getByRole("link", { name: /go to your list/i }),
    ).toHaveAttribute("href", "/list");
    expect(
      screen.queryByRole("link", { name: /sign in to personalise/i }),
    ).not.toBeInTheDocument();
  });

  it("renders city filter chips including All UK", () => {
    renderLeaderboard();
    expect(screen.getByRole("link", { name: "All UK" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "London" })).toHaveAttribute(
      "href",
      "/?city=london",
    );
  });

  it("scopes copy to the active region", () => {
    renderLeaderboard({ activeRegion: { id: "leeds", name: "Leeds" } });
    expect(screen.getByText(/No\. 1 in Leeds/i)).toBeInTheDocument();
  });

  it("renders the not-yet-ranked module with a browse venues link", () => {
    renderLeaderboard();
    expect(screen.getByText("Kaffeine")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse all venues/i }),
    ).toHaveAttribute("href", "/venues");
  });

  it("preserves the region filter on the browse venues link", () => {
    renderLeaderboard({ activeRegion: { id: "london", name: "London" } });
    expect(
      screen.getByRole("link", { name: /browse all venues/i }),
    ).toHaveAttribute("href", "/venues?region=london");
  });

  it("shows an empty state when nothing is ranked", () => {
    renderLeaderboard({ ranked: [] });
    expect(screen.getByText(/no ranked venues/i)).toBeInTheDocument();
  });

  it("omits the not-yet-ranked module when every venue is ranked", () => {
    renderLeaderboard({ unranked: [] });
    expect(screen.queryByText(/not yet ranked/i)).not.toBeInTheDocument();
  });
});
