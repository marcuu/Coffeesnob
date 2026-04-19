"use client";

import { useEffect, useState } from "react";

import { AhaReveal } from "./aha";
import type { Prefs } from "./data";
import { Feed } from "./feed";
import { Sidebar } from "./sidebar";

const KEY = "coffeesnob.v2.prefs";

const INITIAL: Prefs = {
  city: "london",
  drink: [],
  pairPicks: {},
  axes: null,
};

export function OnboardingApp() {
  const [prefs, setPrefs] = useState<Prefs>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ahaOpen, setAhaOpen] = useState(false);
  const [seenAha, setSeenAha] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({ ...INITIAL, ...stored });
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs, hydrated]);

  // Fire the aha reveal the FIRST time flavour axes become defined.
  useEffect(() => {
    if (prefs.axes && !seenAha) {
      setSeenAha(true);
      setSidebarOpen(false);
      const t = setTimeout(() => setAhaOpen(true), 320);
      return () => clearTimeout(t);
    }
  }, [prefs.axes, seenAha]);

  function reset() {
    setPrefs(INITIAL);
    setSeenAha(false);
  }

  const hasPrefs = !!prefs.axes || (prefs.drink && prefs.drink.length > 0);

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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
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
        <Feed prefs={prefs} onOpenSidebar={() => setSidebarOpen(true)} />
      </main>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        prefs={prefs}
        setPrefs={setPrefs}
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
        onClose={() => setAhaOpen(false)}
        onDone={() => setAhaOpen(false)}
      />
    </div>
  );
}
