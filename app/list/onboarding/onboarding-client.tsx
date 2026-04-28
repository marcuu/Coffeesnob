"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { acknowledgeRankingOnboarding } from "./actions";
import { RankedList, type RankedItem } from "@/components/list/ranked-list";
import type { ReviewBucket } from "@/lib/types";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

export function OnboardingClient({
  byBucket,
  reviewerId: _reviewerId,
}: {
  byBucket: Record<ReviewBucket, RankedItem[]>;
  reviewerId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const acknowledge = () => {
    startTransition(async () => {
      await acknowledgeRankingOnboarding();
      router.push("/list");
    });
  };

  const totals =
    byBucket.pilgrimage.length +
    byBucket.detour.length +
    byBucket.convenience.length;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 96px" }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ ...MONO, color: "oklch(0.75 0.11 44)", marginBottom: 12 }}>
          Welcome to your list
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px,4vw,40px)",
            color: "hsl(60 9.1% 97.8%)",
            letterSpacing: "-0.02em",
            marginBottom: 14,
          }}
        >
          We&apos;ve sorted your {totals} reviews into pilgrimages, detours and
          convenience stops.
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "hsl(24 5.4% 70%)",
            lineHeight: 1.7,
          }}
        >
          Have a look — drag to refine within a bucket, or move a venue to a
          different bucket if it lands wrong. Once you&apos;re happy, hit
          &ldquo;Looks right&rdquo; below.
        </p>
      </header>

      <RankedList initialByBucket={byBucket} />

      <div
        style={{
          marginTop: 36,
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={acknowledge}
          disabled={pending}
          style={{
            ...MONO,
            height: 40,
            padding: "0 24px",
            background: "oklch(0.75 0.11 44)",
            color: "hsl(20 14.3% 4%)",
            border: "none",
            borderRadius: 2,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Saving…" : "Looks right"}
        </button>
      </div>
    </main>
  );
}
