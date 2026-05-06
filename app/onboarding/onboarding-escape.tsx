"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { completeOnboarding } from "./actions";

const MIN_RANKED_TO_CONTINUE = 3;

export function OnboardingEscape({ nextHref }: { nextHref: string }) {
  const router = useRouter();
  const [rankedCount, setRankedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const readRankedCount = () => {
      const match = document.body.innerText.match(/priming\s*.\s*(\d+)\s+of\s+\d+\s+ranked/i);
      setRankedCount(match ? Number(match[1]) : 0);
    };

    readRankedCount();
    const observer = new MutationObserver(readRankedCount);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const complete = async () => {
    setBusy(true);
    setError(null);
    const result = await completeOnboarding();
    if (result.status === "ok") {
      router.push(nextHref);
    } else {
      setBusy(false);
      setError(result.message);
    }
  };

  const canContinue = rankedCount >= MIN_RANKED_TO_CONTINUE;

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 80,
          display: "flex",
          alignItems: "center",
          gap: 14,
          pointerEvents: "auto",
        }}
      >
        {canContinue && (
          <button
            type="button"
            onClick={complete}
            disabled={busy}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 2,
              border: "none",
              background: "oklch(0.75 0.11 44)",
              color: "hsl(20 14.3% 4%)",
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "Saving..." : "Continue"}
          </button>
        )}
        <button
          type="button"
          onClick={complete}
          disabled={busy}
          aria-label="Skip onboarding for now"
          style={{
            padding: 0,
            border: "none",
            background: "transparent",
            color: "hsl(24 5.4% 40%)",
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: busy ? 0.25 : 0.38,
          }}
        >
          Skip
        </button>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 78,
            transform: "translateX(-50%)",
            zIndex: 90,
            maxWidth: 480,
            padding: "12px 16px",
            borderRadius: 4,
            background: "hsl(0 84.2% 60.2% / 0.16)",
            color: "hsl(0 84.2% 80%)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
