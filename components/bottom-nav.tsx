"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogSheet, type RecentVenue } from "@/components/log-sheet";

type Props = {
  isLoggedIn: boolean;
  profileHref: string;
  recentVenues?: RecentVenue[];
};

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Marks the tab active for the exact path or any sub-path. */
  match: (pathname: string) => boolean;
};

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function BottomNav({ isLoggedIn, profileHref, recentVenues = [] }: Props) {
  const pathname = usePathname();
  const [logOpen, setLogOpen] = useState(false);

  const items: Item[] = [
    {
      href: "/",
      label: "Rankings",
      match: (p) => p === "/" || p.startsWith("/rankings"),
      icon: (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      ),
    },
    {
      href: "/venues",
      label: "Venues",
      match: (p) => p.startsWith("/venues"),
      icon: (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M10 2v2" />
          <path d="M14 2v2" />
          <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
          <path d="M6 2v2" />
        </svg>
      ),
    },
    ...(isLoggedIn
      ? [
          {
            href: "/list",
            label: "Your list",
            match: (p: string) => p.startsWith("/list"),
            icon: (
              <svg {...ICON_PROPS} aria-hidden="true">
                <path d="M3 6h13" />
                <path d="M3 12h13" />
                <path d="M3 18h13" />
                <path d="m19 5 2 2-2 2" />
              </svg>
            ),
          },
        ]
      : []),
    {
      href: isLoggedIn ? profileHref : "/login",
      label: isLoggedIn ? "Profile" : "Sign in",
      match: (p) => p.startsWith("/profile") || p.startsWith("/login"),
      icon: (
        <svg {...ICON_PROPS} aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      ),
    },
  ];

  // The capture action sits dead centre, under the thumb.
  const mid = Math.ceil(items.length / 2);
  const left = isLoggedIn ? items.slice(0, mid) : items;
  const right = isLoggedIn ? items.slice(mid) : [];

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {left.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
        {isLoggedIn ? (
          <button
            type="button"
            className="bottom-nav-item"
            onClick={() => setLogOpen(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-accent)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: "var(--radius-full)",
                border: "1.5px solid currentColor",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              +
            </span>
            <span>Log</span>
          </button>
        ) : null}
        {right.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
      </nav>
      {logOpen ? (
        <LogSheet recentVenues={recentVenues} onClose={() => setLogOpen(false)} />
      ) : null}
    </>
  );
}

function NavLink({ item, pathname }: { item: Item; pathname: string }) {
  return (
    <Link
      href={item.href}
      className="bottom-nav-item"
      data-active={item.match(pathname)}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );
}
