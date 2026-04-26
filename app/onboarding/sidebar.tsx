"use client";

import { useState } from "react";

import {
  DRINKS,
  FLAVOUR_PAIRS,
  type FlavourOption,
  type FlavourPair,
  type Prefs,
  type Region,
} from "./data";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  regions: Region[];
  onReveal: () => void;
  onReset?: () => void;
};

type SectionId = "city" | "drink" | "flavour";

export function Sidebar({
  open,
  onClose,
  prefs,
  setPrefs,
  regions,
  onReveal,
  onReset,
}: SidebarProps) {
  const [section, setSection] = useState<SectionId>("city");

  const firstUnansweredIdx = FLAVOUR_PAIRS.findIndex(
    (p) => !prefs.pairPicks?.[p.id],
  );
  const [pairIdx, setPairIdx] = useState<number>(
    firstUnansweredIdx === -1
      ? FLAVOUR_PAIRS.length
      : Math.max(0, firstUnansweredIdx),
  );

  function handleReset() {
    onReset?.();
    setPairIdx(0);
  }

  const hasAnything = !!(prefs.region || (prefs.drink && prefs.drink.length > 0) || prefs.axes);

  function pickPair(pair: FlavourPair, opt: FlavourOption) {
    const pairPicks: Record<string, string> = {
      ...(prefs.pairPicks || {}),
      [pair.id]: opt.id,
    };
    const axes: Record<string, number> = {};
    FLAVOUR_PAIRS.forEach((p) => {
      const chosenId = pairPicks[p.id];
      if (!chosenId) return;
      const chosen = p.options.find((o) => o.id === chosenId);
      if (!chosen) return;
      for (const k in chosen.axes) {
        axes[k] = (axes[k] || 0) + (chosen.axes[k as keyof typeof chosen.axes] || 0);
      }
    });
    const max = Math.max(1, ...Object.values(axes));
    for (const k in axes) axes[k] = axes[k] / max;
    setPrefs({ ...prefs, pairPicks, axes });
    setPairIdx((i) => i + 1);
  }

  function skipFlavour() {
    setPairIdx(FLAVOUR_PAIRS.length);
  }

  const sections: { id: SectionId; label: string; done: boolean }[] = [
    { id: "city", label: "Location", done: !!prefs.region },
    {
      id: "drink",
      label: "Drink",
      done: !!(prefs.drink && prefs.drink.length),
    },
    { id: "flavour", label: "Taste", done: !!prefs.axes },
  ];

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,14,10,0.24)",
          zIndex: 30,
          animation: "onboardingFadeIn 180ms ease",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(440px, 92vw)",
          zIndex: 40,
          background: "var(--color-background)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-20px 0 60px -30px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          animation: "onboardingSlideInRight 320ms cubic-bezier(.2,.7,.2,1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-muted-foreground)",
              }}
            >
              Tune your feed
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                marginTop: 2,
              }}
            >
              Three quick things.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--color-muted-foreground)",
              cursor: "pointer",
              fontSize: 20,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            padding: "10px 20px",
            gap: 6,
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {sections.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: `1px solid ${section === s.id ? "var(--color-accent)" : "var(--color-border)"}`,
                borderRadius: "var(--radius)",
                background:
                  section === s.id
                    ? "var(--color-accent-soft)"
                    : "var(--color-background)",
                color:
                  section === s.id
                    ? "var(--color-accent)"
                    : "var(--color-foreground)",
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {s.label}
              {s.done && (
                <span style={{ color: "var(--color-accent)" }}>✓</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {section === "city" && (
            <CityPanel
              prefs={prefs}
              setPrefs={setPrefs}
              regions={regions}
              onNext={() => setSection("drink")}
            />
          )}
          {section === "drink" && (
            <DrinkPanel
              prefs={prefs}
              setPrefs={setPrefs}
              onNext={() => setSection("flavour")}
            />
          )}
          {section === "flavour" && (
            <FlavourPanel
              pairIdx={pairIdx}
              onPick={pickPair}
              onSkip={skipFlavour}
              onRestart={() => {
                setPrefs({ ...prefs, pairPicks: {}, axes: null });
                setPairIdx(0);
              }}
            />
          )}
        </div>

        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-muted)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-muted-foreground)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {sections.filter((s) => s.done).length}/3 complete · all optional
            </span>
            {hasAnything && (
              <button
                type="button"
                onClick={handleReset}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted-foreground)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                  textAlign: "left",
                }}
              >
                reset all
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onReveal}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: "var(--radius)",
              background: prefs.axes
                ? "var(--color-primary)"
                : "var(--color-muted)",
              color: prefs.axes
                ? "var(--color-primary-foreground)"
                : "var(--color-foreground)",
              border: `1px solid ${prefs.axes ? "var(--color-primary)" : "var(--color-border)"}`,
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              opacity: prefs.axes ? 1 : 0.5,
            }}
          >
            {prefs.axes ? "See your match" : "Apply & close"}
          </button>
        </div>
      </aside>
    </>
  );
}

type PanelProps = {
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  onNext: () => void;
};

type CityPanelProps = PanelProps & { regions: Region[] };

function CityPanel({ prefs, setPrefs, regions, onNext }: CityPanelProps) {
  const [geo, setGeo] = useState<"idle" | "locating" | "error" | "done">(
    "idle",
  );

  function regionIdFromCoords(lat: number, lon: number): string | null {
    if (lon < -5.4 && lat >= 54.0 && lat <= 55.4) return "northern-ireland";
    if (lat >= 55.05) return "scotland";
    if (lon < -3.0 && lat >= 51.3 && lat <= 53.5) return "wales";
    if (lat >= 51.28 && lat <= 51.72 && lon >= -0.55 && lon <= 0.35) return "london";
    if (lat >= 54.4 && lon >= -2.5 && lon <= -0.5) return "north-east";
    if (lat >= 53.3 && lat <= 55.4 && lon < -2.3) return "north-west";
    if (lat >= 53.3 && lat <= 54.6 && lon >= -2.3 && lon <= 0.1) return "yorkshire";
    if (lat >= 51.9 && lat <= 53.2 && lon >= -3.1 && lon < -0.8) return "west-midlands";
    if (lat >= 52.0 && lat <= 53.5 && lon >= -0.8 && lon <= 0.8) return "east-midlands";
    if (lat >= 51.5 && lat <= 53.0 && lon > 0.0) return "east-of-england";
    if (lon < -2.0 && lat <= 51.8) return "south-west";
    if (lat >= 50.7 && lat <= 51.8) return "south-east";
    return null;
  }

  function tryGeo() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("error");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const regionId = regionIdFromCoords(latitude, longitude);
        const matched = regionId
          ? (regions.find((r) => r.id === regionId) ?? regions[0])
          : regions[0];
        if (matched) {
          setPrefs({ ...prefs, region: matched.id });
          setGeo("done");
        } else {
          setGeo("error");
        }
      },
      () => {
        setGeo("error");
      },
      { timeout: 10000 },
    );
  }

  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
        Which region do you drink in?
      </h3>
      <p
        style={{
          marginTop: 4,
          marginBottom: 14,
          fontSize: 13,
          color: "var(--color-muted-foreground)",
        }}
      >
        We&rsquo;ll boost venues in your area.
      </p>

      <button
        type="button"
        onClick={tryGeo}
        disabled={geo === "locating"}
        style={{
          height: 36,
          padding: "0 14px",
          marginBottom: 14,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          background: "var(--color-background)",
          color: "var(--color-foreground)",
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        {geo === "locating"
          ? "Locating…"
          : geo === "error"
            ? "Couldn't locate — pick below"
            : geo === "done"
              ? "✓ Located"
              : "📍 Use my location"}
      </button>
      {geo === "error" && (
        <div
          style={{
            fontSize: 12,
            color: "var(--color-muted-foreground)",
            marginBottom: 10,
          }}
        >
          Permission denied or unavailable. Pick manually below.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}
      >
        {regions.map((r) => (
          <button
            type="button"
            key={r.id}
            onClick={() => setPrefs({ ...prefs, region: r.id })}
            style={{
              padding: "10px 12px",
              textAlign: "left",
              border: `1px solid ${prefs.region === r.id ? "var(--color-accent)" : "var(--color-border)"}`,
              background:
                prefs.region === r.id
                  ? "var(--color-accent-soft)"
                  : "var(--color-background)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-muted-foreground)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {r.venues} venue{r.venues === 1 ? "" : "s"}
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!prefs.region}
        style={{
          marginTop: 16,
          height: 38,
          padding: "0 20px",
          border: "1px solid var(--color-primary)",
          background: prefs.region ? "var(--color-primary)" : "var(--color-muted)",
          color: prefs.region ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
          borderRadius: "var(--radius)",
          cursor: prefs.region ? "pointer" : "default",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
          opacity: prefs.region ? 1 : 0.5,
        }}
      >
        Next →
      </button>
    </div>
  );
}

function DrinkPanel({ prefs, setPrefs, onNext }: PanelProps) {
  const selected = new Set(prefs.drink || []);

  function toggle(id: (typeof DRINKS)[number]["id"]) {
    if (id === "any") {
      setPrefs({ ...prefs, drink: ["any"] });
      return;
    }
    const next = selected.has(id)
      ? [...selected].filter((x) => x !== id)
      : [...selected].filter((x) => x !== "any").concat(id);
    setPrefs({ ...prefs, drink: next });
  }

  return (
    <div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
        What do you order?
      </h3>
      <p
        style={{
          marginTop: 4,
          marginBottom: 14,
          fontSize: 13,
          color: "var(--color-muted-foreground)",
        }}
      >
        Pick any that apply.
      </p>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
      >
        {DRINKS.map((d) => (
          <button
            type="button"
            key={d.id}
            onClick={() => toggle(d.id)}
            style={{
              padding: "10px 12px",
              textAlign: "left",
              border: `1px solid ${selected.has(d.id) ? "var(--color-accent)" : "var(--color-border)"}`,
              background: selected.has(d.id)
                ? "var(--color-accent-soft)"
                : "var(--color-background)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onNext}
        style={{
          marginTop: 16,
          height: 38,
          padding: "0 20px",
          border: "1px solid var(--color-primary)",
          background: "var(--color-primary)",
          color: "var(--color-primary-foreground)",
          borderRadius: "var(--radius)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Next →
      </button>
    </div>
  );
}

type FlavourPanelProps = {
  pairIdx: number;
  onPick: (pair: FlavourPair, opt: FlavourOption) => void;
  onSkip: () => void;
  onRestart: () => void;
};

function FlavourPanel({
  pairIdx,
  onPick,
  onSkip,
  onRestart,
}: FlavourPanelProps) {
  if (pairIdx >= FLAVOUR_PAIRS.length) {
    return (
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Taste locked in.
        </h3>
        <p
          style={{
            marginTop: 4,
            fontSize: 13,
            color: "var(--color-muted-foreground)",
          }}
        >
          We&rsquo;ve built your flavour profile. Close this to see updated
          picks.
        </p>
        <button
          type="button"
          onClick={onRestart}
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "var(--color-muted-foreground)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Retake
        </button>
      </div>
    );
  }
  const pair = FLAVOUR_PAIRS[pairIdx];
  return (
    <div key={pair.id} style={{ animation: "onboardingFadeIn 300ms ease" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-muted-foreground)",
        }}
      >
        Round {pairIdx + 1} of {FLAVOUR_PAIRS.length}
      </div>
      <h3
        style={{
          margin: "6px 0 14px",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {pair.prompt}
      </h3>
      <div style={{ display: "grid", gap: 10 }}>
        {pair.options.map((o) => (
          <button
            type="button"
            key={o.id}
            onClick={() => onPick(pair, o)}
            style={{
              textAlign: "left",
              padding: "16px 18px",
              border: "2px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-background)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "all 160ms",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.background = "var(--color-accent-soft)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.background = "var(--color-background)";
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{o.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 2,
                  letterSpacing: "0.02em",
                }}
              >
                {o.notes}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-muted-foreground)",
                  marginTop: 6,
                  textWrap: "pretty",
                }}
              >
                {o.body}
              </div>
            </div>
            <div
              style={{
                fontSize: 18,
                color: "var(--color-border)",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              →
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSkip}
        style={{
          marginTop: 14,
          fontSize: 12,
          color: "var(--color-muted-foreground)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textDecoration: "underline",
          padding: 0,
        }}
      >
        Not sure — skip taste
      </button>
    </div>
  );
}
