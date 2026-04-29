"use client";

import { useId } from "react";

type AxisKey = "coffee" | "vibe";

const COPY: Record<AxisKey, { label: string; question: string }> = {
  coffee: { label: "Coffee", question: "How was the coffee itself?" },
  vibe: { label: "Vibe", question: "How was everything else?" },
};

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

// 1-5 sliders, no auto-fill default, both required. The parent owns the
// state and tracks which axes have been touched (a null value = untouched).
// Callbacks fire only when the user moves the slider, which sets the value
// to a real 1-5 integer.
export function TwoAxisSliders({
  coffee,
  vibe,
  onChange,
}: {
  coffee: number | null;
  vibe: number | null;
  onChange: (next: { coffee?: number; vibe?: number }) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Slider
        axis="coffee"
        value={coffee}
        onChange={(v) => onChange({ coffee: v })}
      />
      <Slider
        axis="vibe"
        value={vibe}
        onChange={(v) => onChange({ vibe: v })}
      />
    </div>
  );
}

function Slider({
  axis,
  value,
  onChange,
}: {
  axis: AxisKey;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const copy = COPY[axis];
  const touched = value !== null;
  // Use 3 (the midpoint) as the visual position for an untouched slider so
  // the thumb has somewhere to render, but show "—" in the readout.
  const visual = touched ? value : 3;
  return (
    <div data-testid={`two-axis-slider-${axis}`}>
      <label htmlFor={id} style={{ ...MONO, color: "hsl(24 5.4% 40%)", display: "block", marginBottom: 6 }}>
        {copy.label}
      </label>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 18,
          color: "hsl(60 9.1% 97.8%)",
          marginBottom: 14,
        }}
      >
        {copy.question}
      </p>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 56,
            color: touched ? "oklch(0.75 0.11 44)" : "hsl(24 5.4% 28%)",
            lineHeight: 1,
          }}
        >
          {touched ? value : "—"}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "hsl(24 5.4% 36%)" }}>
          /5
        </div>
      </div>

      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={visual}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={copy.label}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={touched ? value : undefined}
        style={{
          width: "100%",
          accentColor: "oklch(0.75 0.11 44)",
          cursor: "pointer",
          marginBottom: 6,
          opacity: touched ? 1 : 0.5,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          ...MONO,
          fontSize: 9,
          color: "hsl(24 5.4% 36%)",
        }}
      >
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
      </div>
    </div>
  );
}
