import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopNav } from "@/app/onboarding/top-nav";

vi.mock("next/navigation", () => ({ permanentRedirect: vi.fn() }));

describe("TopNav", () => {
  it("renders logged-out nav actions", () => {
    render(<TopNav ctaHref="/login" ctaLabel="Sign in to personalise" />);

    expect(screen.getByRole("link", { name: /browse venues/i })).toHaveAttribute(
      "href",
      "/venues",
    );
    expect(
      screen.getByRole("link", { name: /sign in to personalise/i }),
    ).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /my profile/i })).not.toBeInTheDocument();
  });

  it("renders signed-in nav actions", () => {
    const onCtaClick = vi.fn();
    render(
      <TopNav
        profileHref="/profile/alice"
        ctaLabel="Tune feed"
        onCtaClick={onCtaClick}
      />,
    );

    expect(screen.getByRole("link", { name: /my profile/i })).toHaveAttribute(
      "href",
      "/profile/alice",
    );
    screen.getByRole("button", { name: /tune feed/i }).click();
    expect(onCtaClick).toHaveBeenCalledTimes(1);
  });
});
