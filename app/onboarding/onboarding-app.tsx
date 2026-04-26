"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { VenueSearch } from "@/components/VenueSearch";

import { AhaReveal } from "./aha";
import type { OnboardingVenue, Prefs, Region } from "./data";
import { Feed } from "./feed";
import { Sidebar } from "./sidebar";

const KEY = "coffeesnob.v2.prefs";

const NAV_LINK: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-muted-foreground)",
  textDecoration: "none",
  transition: "color 160ms",
};

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

  if (venues.length === 0) {
    return (
      <main
        style={{ maxWidth: 920, margin: "0 auto", padding: "64px 36px 140px" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px,3vw,40px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
          }}
        >
          No venues yet.
        </h1>
        <p
          style={{
            marginTop: 14,
            fontSize: 15,
            color: "var(--color-muted-foreground)",
            lineHeight: 1.65,
          }}
        >
          The feed lights up once the first venue is added. Head to{" "}
          <Link
            href="/venues"
            style={{ color: "var(--color-accent)", textDecoration: "underline" }}
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
            "color-mix(in oklab, var(--color-background) 90%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            padding: "16px 36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              textDecoration: "none",
              color: "var(--color-foreground)",
            }}
          >
            Coffeesnob
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <VenueSearch />
            <Link href="/venues" style={NAV_LINK}>
              Venues
            </Link>
            <Link href="/rankings" style={NAV_LINK}>
              Rankings
            </Link>
            <Link
              href={profileHref}
              style={{ ...NAV_LINK, color: "var(--color-foreground)" }}
            >
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <main
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "64px 36px 140px",
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
