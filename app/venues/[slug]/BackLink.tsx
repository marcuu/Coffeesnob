"use client";

import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--color-muted-foreground)",
        textDecoration: "none",
        display: "inline-block",
        marginBottom: 48,
        transition: "color 150ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-foreground)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted-foreground)"; }}
    >
      ← {label}
    </Link>
  );
}
