"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AhaReveal } from "./aha";
import type { OnboardingVenue, Prefs, Region } from "./data";
import { Feed } from "./feed";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

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
      <TopNav
        profileHref={profileHref}
        ctaLabel={hasPrefs ? "Edit taste" : "Tune feed"}
        ctaHasAccentDot={hasPrefs}
        onCtaClick={() => setSidebarOpen(true)}
      />

      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "40px 20px 120px",
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
