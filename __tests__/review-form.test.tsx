import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewForm } from "@/app/venues/[slug]/review-form";

vi.mock("@/app/venues/[slug]/actions", () => ({
  createReview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ReviewForm", () => {
  it("starts the 8-step flow at ambience and progressively reveals guidance", () => {
    render(<ReviewForm venueId="venue-1" slug="test-venue" />);

    const slider = screen.getByRole("slider");
    expect(slider).toHaveValue("5");

    expect(screen.getByText("Step 1 of 8")).toBeInTheDocument();
    expect(screen.getByText("Ambience")).toBeInTheDocument();
    expect(screen.getByText(/third.?wave coffee/i)).toBeInTheDocument();
    expect(screen.queryByText(/travelling 3 hours/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Step 2 of 8")).toBeInTheDocument();
    expect(screen.getByText(/travelling 30 minutes/i)).toBeInTheDocument();
  });

  it("shows date and notes on dedicated steps and post review CTA on the last step", () => {
    render(<ReviewForm venueId="venue-1" slug="test-venue" />);

    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    }

    expect(screen.getByText("Step 7 of 8")).toBeInTheDocument();
    expect(screen.getByLabelText(/when did you visit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Step 8 of 8")).toBeInTheDocument();
    expect(screen.getByLabelText(/tell us about your visit/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post review/i })).toBeInTheDocument();
  });
});
