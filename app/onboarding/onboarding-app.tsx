"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AhaReveal } from "./aha";
import type { OnboardingVenue, Prefs, Region } from "./data";
import { Feed } from "./feed";
import { Sidebar } from "./sidebar";

const KEY = "coffeesnob.v2.prefs";

function initialPrefs(regions: Region[]): Prefs {
  void regions;
  return {
    region: "",
    drink: [],
    pairPicks: {},
    axes: null,
  };
}

type OnboardingAppProps = {
  venues: OnboardingVenue[];
  regions: Region[];
  profileHref: string;
};

export function OnboardingApp({ venues, regions, profileHref }: OnboardingAppProps) {
  const initial = useMemo(() => initialPrefs(regions), [regions]);
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ahaOpen, setAhaOpen] = useState(false);
  const [seenAha, setSeenAha] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Prefs>;
        const regionIds = new Set(regions.map((r) => r.id));
        const safeRegion =
          stored.region && regionIds.has(stored.region) ? stored.region : initial.region;
        setPrefs({ ...initial, ...stored, region: safeRegion });
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [regions, initial]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs, hydrated]);

  useEffect(() => {
    if (prefs.axes && !seenAha) {
      setSeenAha(true);
      setSidebarOpen(false);
      const t = setTimeout(() => setAhaOpen(true), 320);
      return () => clearTimeout(t);
    }
  }, [prefs.axes, seenAha]);

  function reset() {
    setPrefs(initial);
    setSeenAha(false);
  }

  const hasPrefs = !!prefs.axes || (prefs.drink && prefs.drink.length > 0);

  if (venues.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          No venues yet.
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          The feed lights up once the first venue is added. Head to{" "}
          <Link
            href="/venues"
            style={{
              color: "var(--color-accent)",
              textDecoration: "underline",
            }}
          >
            venues
          </Link>{" "}
          to add one.
        </p>
      </main>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background:
            "color-mix(in oklab, var(--color-background) 92%, transparent)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 19,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                textDecoration: "none",
                color: "var(--color-foreground)",
              }}
            >
              Coffeesnob
            </Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/rankings"
              aria-label="Rankings"
              style={{
                color: "var(--color-muted-foreground)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
              </svg>
            </Link>
            <Link
              href="/venues"
              aria-label="Browse venues"
              style={{
                color: "var(--color-muted-foreground)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </Link>
            <Link
              href={profileHref}
              aria-label="My profile"
              style={{
                color: "var(--color-muted-foreground)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              style={{
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
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: hasPrefs
                    ? "var(--color-accent)"
                    : "var(--color-muted-foreground)",
                }}
              />
              {hasPrefs ? "Edit taste" : "Tune feed"}
            </button>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "40px 28px 120px",
        }}
      >
        <Feed
          venues={venues}
          regions={regions}
          prefs={prefs}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </main>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
        regions={regions}
        onReset={reset}
        onReveal={() => {
          setSidebarOpen(false);
          if (prefs.axes) {
            const t = setTimeout(() => setAhaOpen(true), 200);
            return () => clearTimeout(t);
          }
        }}
      />

      <AhaReveal
        open={ahaOpen}
        prefs={prefs}
        venues={venues}
        onClose={() => setAhaOpen(false)}
        onDone={() => setAhaOpen(false)}
      />
    </div>
  );
}
