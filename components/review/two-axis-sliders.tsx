"use client";

import { track } from "@/lib/analytics";

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

// 1-5 discrete selectors, no auto-fill default, both required. The parent
// owns the state and tracks which axes have been touched (null = untouched).
// Using discrete buttons instead of a native range input avoids the iOS Safari
// "tap midpoint, no change event fires" bug where tapping position 3 on an
// already-at-3 range input silently does nothing.
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
  const copy = COPY[axis];
  const touched = value !== null;

  const handleSelect = (v: number) => {
    track({ name: "slider_value_selected", axis, final_value: v });
    onChange(v);
  };

  return (
    <div data-testid={`two-axis-slider-${axis}`}>
      <label style={{ ...MONO, color: "hsl(24 5.4% 40%)", display: "block", marginBottom: 6 }}>
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

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
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

      <div
        role="group"
        aria-label={copy.label}
        style={{ display: "flex", gap: 8 }}
      >
        {([1, 2, 3, 4, 5] as const).map((v) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              aria-label={`${copy.label} ${v}`}
              aria-pressed={selected}
              data-testid={`slider-${axis}-${v}`}
              onClick={() => handleSelect(v)}
              style={{
                flex: 1,
                height: 48,
                border: selected
                  ? "1px solid oklch(0.75 0.11 44)"
                  : "1px solid rgba(255,255,255,0.15)",
                borderRadius: 2,
                background: selected
                  ? "rgba(241,168,113,0.12)"
                  : "rgba(255,255,255,0.03)",
                color: selected ? "oklch(0.75 0.11 44)" : "hsl(24 5.4% 52%)",
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                cursor: "pointer",
                transition: "background 120ms, border-color 120ms, color 120ms",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
