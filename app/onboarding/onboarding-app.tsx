"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AhaReveal } from "./aha";
import type { City, OnboardingVenue, Prefs } from "./data";
import { Feed } from "./feed";
import { Sidebar } from "./sidebar";

const KEY = "coffeesnob.v2.prefs";

function initialPrefs(cities: City[]): Prefs {
  void cities;
  return {
    city: "",
    drink: [],
    pairPicks: {},
    axes: null,
  };
}

type OnboardingAppProps = {
  venues: OnboardingVenue[];
  cities: City[];
};

export function OnboardingApp({ venues, cities }: OnboardingAppProps) {
  const initial = useMemo(() => initialPrefs(cities), [cities]);
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
        const cityIds = new Set(cities.map((c) => c.id));
        const safeCity =
          stored.city && cityIds.has(stored.city) ? stored.city : initial.city;
        setPrefs({ ...initial, ...stored, city: safeCity });
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [cities, initial]);

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
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 19,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              Coffeesnob
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/venues"
              style={{
                fontSize: 13,
                color: "var(--color-muted-foreground)",
                textDecoration: "none",
                fontFamily: "var(--font-sans)",
              }}
            >
              Browse venues
            </Link>
            {hasPrefs && (
              <button
                type="button"
                onClick={reset}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted-foreground)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                reset
              </button>
            )}
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
          cities={cities}
          prefs={prefs}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </main>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
        cities={cities}
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
