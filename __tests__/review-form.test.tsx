import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewForm } from "@/app/venues/[slug]/review-form";

vi.mock("@/app/venues/[slug]/actions", () => ({
  createReview: vi.fn(),
}));

describe("ReviewForm", () => {
  it("starts the 6-step flow at ambience with third-wave score guidance", () => {
    render(<ReviewForm venueId="venue-1" slug="test-venue" />);

    const slider = screen.getByRole("slider");
    expect(slider).toHaveValue("5");

    expect(screen.getByText("Step 1 of 6: Ambience")).toBeInTheDocument();
    expect(screen.getByText(/third.?wave coffee/i)).toBeInTheDocument();
    expect(screen.getByText(/travelling 3 hours/i)).toBeInTheDocument();
  });
});
