import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TwoAxisSliders } from "@/components/review/two-axis-sliders";

describe("TwoAxisSliders", () => {
  it("renders both axes with no auto-fill default", () => {
    render(<TwoAxisSliders coffee={null} vibe={null} onChange={() => {}} />);

    // The numeric readout shows '—' (em-dash) for an untouched slider.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Coffee")).toBeInTheDocument();
    expect(screen.getByLabelText("Vibe")).toBeInTheDocument();
  });

  it("calls onChange with the chosen 1-5 value when the user moves the coffee slider", () => {
    const onChange = vi.fn();
    render(<TwoAxisSliders coffee={null} vibe={null} onChange={onChange} />);
    const coffee = screen.getByLabelText("Coffee") as HTMLInputElement;
    fireEvent.change(coffee, { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith({ coffee: 4 });
  });

  it("calls onChange with the chosen 1-5 value when the user moves the vibe slider", () => {
    const onChange = vi.fn();
    render(<TwoAxisSliders coffee={null} vibe={null} onChange={onChange} />);
    const vibe = screen.getByLabelText("Vibe") as HTMLInputElement;
    fireEvent.change(vibe, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith({ vibe: 2 });
  });

  it("renders the chosen value when the parent supplies one", () => {
    render(<TwoAxisSliders coffee={5} vibe={3} onChange={() => {}} />);
    // Grab the values from the slider input itself (the big numeric readout
    // collides with the 1-5 axis labels in getByText).
    const coffee = screen.getByLabelText("Coffee") as HTMLInputElement;
    const vibe = screen.getByLabelText("Vibe") as HTMLInputElement;
    expect(coffee.value).toBe("5");
    expect(vibe.value).toBe("3");
  });

  it("clamps slider min/max to 1-5", () => {
    render(<TwoAxisSliders coffee={3} vibe={3} onChange={() => {}} />);
    const coffee = screen.getByLabelText("Coffee") as HTMLInputElement;
    expect(coffee.min).toBe("1");
    expect(coffee.max).toBe("5");
  });
});
