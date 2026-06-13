"use client";

import { useState, useTransition } from "react";

import {
  addToWishlist,
  removeFromWishlist,
} from "@/app/onboarding/actions";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

/**
 * Optimistic "Want to try" toggle. State flips immediately; the server action
 * settles in the background and reverts on failure.
 */
export function WishlistButton({
  venueId,
  initialInWishlist,
  compact = false,
}: {
  venueId: string;
  initialInWishlist: boolean;
  /** Icon-only square for quiet action rows. */
  compact?: boolean;
}) {
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [, startTransition] = useTransition();

  const toggle = () => {
    const next = !inWishlist;
    setInWishlist(next);
    startTransition(async () => {
      const result = next
        ? await addToWishlist(venueId)
        : await removeFromWishlist(venueId);
      if (result.status === "error") setInWishlist(!next);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={inWishlist}
      aria-label={inWishlist ? "Remove from wishlist" : "Want to try"}
      title={inWishlist ? "On your wishlist" : "Want to try"}
      style={{
        ...MONO,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        minHeight: 44,
        ...(compact ? { width: 44, padding: 0 } : { padding: "0 20px" }),
        background: inWishlist ? "var(--color-accent-soft)" : "transparent",
        border: `1px solid ${
          inWishlist ? "var(--color-accent)" : "var(--color-border)"
        }`,
        borderRadius: 2,
        color: inWishlist
          ? "var(--color-accent)"
          : "var(--color-muted-foreground)",
        cursor: "pointer",
        transition: "color 160ms, border-color 160ms, background 160ms",
      }}
    >
      <BookmarkIcon filled={inWishlist} />
      {compact ? null : inWishlist ? "On your wishlist" : "Want to try"}
    </button>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}
