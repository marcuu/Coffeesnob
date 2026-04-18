import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewForm } from "@/app/venues/[slug]/review-form";

vi.mock("@/app/venues/[slug]/actions", () => ({
  createReview: vi.fn(),
}));

describe("ReviewForm", () => {
  it("defaults all rating sliders to 5/10 before user input", () => {
    render(<ReviewForm venueId="venue-1" slug="test-venue" />);

    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(6);

    for (const slider of sliders) {
      expect(slider).toHaveValue("5");
    }

    const defaultValueLabels = screen.getAllByText("5/10");
    expect(defaultValueLabels).toHaveLength(6);
  });
});
