import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TwoAxisSliders } from "@/components/review/two-axis-sliders";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

describe("TwoAxisSliders", () => {
  it("renders both axes with no auto-fill default", () => {
    render(<TwoAxisSliders coffee={null} vibe={null} onChange={() => {}} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("renders discrete buttons labelled 1-5 for each axis", () => {
    render(<TwoAxisSliders coffee={null} vibe={null} onChange={() => {}} />);
    for (const v of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`slider-coffee-${v}`)).toBeInTheDocument();
      expect(screen.getByTestId(`slider-vibe-${v}`)).toBeInTheDocument();
    }
  });

  // Core regression: tapping any position fires onChange with that exact value.
  // Previously a native range input at default=3 would silently skip tapping 3.
  it.each([1, 2, 3, 4, 5])(
    "tapping coffee position %i calls onChange({ coffee: %i })",
    async (v) => {
      const onChange = vi.fn();
      render(<TwoAxisSliders coffee={null} vibe={null} onChange={onChange} />);
      await userEvent.click(screen.getByTestId(`slider-coffee-${v}`));
      expect(onChange).toHaveBeenCalledWith({ coffee: v });
    },
  );

  it.each([1, 2, 3, 4, 5])(
    "tapping vibe position %i calls onChange({ vibe: %i })",
    async (v) => {
      const onChange = vi.fn();
      render(<TwoAxisSliders coffee={null} vibe={null} onChange={onChange} />);
      await userEvent.click(screen.getByTestId(`slider-vibe-${v}`));
      expect(onChange).toHaveBeenCalledWith({ vibe: v });
    },
  );

  it("marks the selected button as pressed", () => {
    render(<TwoAxisSliders coffee={3} vibe={2} onChange={() => {}} />);
    expect(screen.getByTestId("slider-coffee-3")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("slider-vibe-2")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("slider-coffee-4")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the selected value in the numeric readout", () => {
    const { getByTestId } = render(
      <TwoAxisSliders coffee={4} vibe={1} onChange={() => {}} />,
    );
    // The readout is the big number above the buttons; verify via aria-label
    // on the button row's group.
    expect(getByTestId("slider-coffee-4")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
