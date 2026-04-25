"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type TopNavProps = {
  profileHref?: string;
  ctaLabel: string;
  ctaHasAccentDot?: boolean;
  onCtaClick?: () => void;
  ctaHref?: string;
};

export function TopNav({
  profileHref,
  ctaLabel,
  ctaHasAccentDot = false,
  onCtaClick,
  ctaHref,
}: TopNavProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "color-mix(in oklab, var(--color-background) 92%, transparent)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            textDecoration: "none",
            color: "var(--color-foreground)",
            whiteSpace: "nowrap",
          }}
        >
          Coffeesnob
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <NavIcon href="/venues" ariaLabel="Browse venues">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </NavIcon>

          {profileHref ? (
            <NavIcon href={profileHref} ariaLabel="My profile">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </NavIcon>
          ) : null}

          {ctaHref ? (
            <Link href={ctaHref} style={ctaButtonStyle}>
              {ctaLabel}
            </Link>
          ) : (
            <button type="button" onClick={onCtaClick} style={ctaButtonStyle}>
              {ctaHasAccentDot ? (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "var(--color-accent)",
                  }}
                />
              ) : null}
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

type NavIconProps = {
  href: string;
  ariaLabel: string;
  children: ReactNode;
};

function NavIcon({ href, ariaLabel, children }: NavIconProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        color: "var(--color-muted-foreground)",
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </Link>
  );
}

const ctaButtonStyle: CSSProperties = {
  height: 34,
  padding: "0 14px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-background)",
  color: "var(--color-foreground)",
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
