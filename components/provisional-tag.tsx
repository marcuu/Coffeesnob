// Compact "Provisional" tag used wherever a venue score is rendered for a
// non-`settled` venue. The tag is the primary uncertainty signal — the
// number itself is now a clean whole, with no approximate notation.
//
// Reuses the existing accent semantic tokens so it tracks the rest of the
// maturity typography rather than hardcoding colours.

import type { CSSProperties } from "react";

const BASE: CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  padding: "2px 6px",
  borderRadius: 2,
  background: "var(--color-accent-soft)",
  color: "var(--color-accent)",
};

export function ProvisionalTag({ style }: { style?: CSSProperties }) {
  return (
    <span style={{ ...BASE, ...style }} title="Provisional — still settling">
      Provisional
    </span>
  );
}
