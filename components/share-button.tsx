"use client";

import { useState } from "react";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

/**
 * Native share sheet where available (mobile), clipboard fallback elsewhere.
 * `path` is app-relative; the absolute URL is resolved at click time.
 */
export function ShareButton({
  title,
  text,
  path,
}: {
  title: string;
  text?: string;
  path: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Cancelled or unsupported payload — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context); nothing else to do.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      style={{
        ...MONO,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        padding: "0 20px",
        background: "transparent",
        border: "1px solid var(--color-border)",
        borderRadius: 2,
        color: "var(--color-muted-foreground)",
        cursor: "pointer",
        transition: "color 160ms, border-color 160ms",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="m16 6-4-4-4 4" />
        <path d="M12 2v13" />
      </svg>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
