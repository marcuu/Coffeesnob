"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Textarea } from "@/components/ui/textarea";

import { createReview, type ReviewFormState } from "./actions";

const initial: ReviewFormState = { status: "idle" };

const AXES = [
  {
    name: "rating_taste" as const,
    label: "Taste",
    desc: "Flavour clarity, sweetness, balance. How good was the coffee itself?",
  },
  {
    name: "rating_body" as const,
    label: "Body",
    desc: "Mouthfeel and texture. Did the coffee linger or disappear?",
  },
  {
    name: "rating_aroma" as const,
    label: "Aroma",
    desc: "The fragrance before and during the cup.",
  },
  {
    name: "rating_ambience" as const,
    label: "Ambience",
    desc: "Setting, noise level, lighting, comfort.",
  },
  {
    name: "rating_service" as const,
    label: "Service",
    desc: "Friendliness, knowledge, speed.",
  },
  {
    name: "rating_value" as const,
    label: "Value",
    desc: "Was it worth what you paid?",
  },
] as const;

type AxisName = (typeof AXES)[number]["name"];

const DEFAULT_RATING = 5;

const TRAVEL_HINTS: [number, string][] = [
  [9, "Worth 3 hours of travel."],
  [8, "Worth 60 minutes of travel."],
  [7, "Worth 30 minutes of travel."],
  [5, "Good, as expected."],
  [0, "Below expectations."],
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

export function ReviewForm({
  venueId,
  slug,
  venueName,
}: {
  venueId: string;
  slug: string;
  venueName?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createReview, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<AxisName, number>>({
    rating_taste: DEFAULT_RATING,
    rating_body: DEFAULT_RATING,
    rating_aroma: DEFAULT_RATING,
    rating_ambience: DEFAULT_RATING,
    rating_service: DEFAULT_RATING,
    rating_value: DEFAULT_RATING,
  });

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/venues/${slug}`);
    }
  }, [state.status, router, slug]);

  const totalSteps = AXES.length + 1; // 6 rating steps + 1 notes step
  const isNotesStep = step === AXES.length;
  const currentAxis = AXES[step];
  const progress = (step / totalSteps) * 100;

  const travelHint = !isNotesStep
    ? TRAVEL_HINTS.find(([n]) => values[currentAxis.name] >= n)?.[1] ?? ""
    : "";

  if (state.status === "success") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 40,
              color: "oklch(0.75 0.11 44)",
              marginBottom: 24,
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 32,
              fontWeight: 400,
              color: "hsl(60 9.1% 97.8%)",
              letterSpacing: "-0.02em",
              marginBottom: 14,
            }}
          >
            Review submitted.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "hsl(24 5.4% 52%)",
              lineHeight: 1.7,
              marginBottom: 36,
            }}
          >
            Thanks for keeping the leaderboard honest.
          </p>
          <Link
            href={`/venues/${slug}`}
            style={{
              ...MONO,
              height: 40,
              padding: "0 24px",
              background: "transparent",
              color: "hsl(60 9.1% 97.8%)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 2,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            Back to {venueName ?? "venue"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="slug" value={slug} />
      {AXES.map(({ name }) => (
        <input key={name} type="hidden" name={name} value={values[name]} />
      ))}

      {/* Top bar */}
      <div
        style={{
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Link
          href={`/venues/${slug}`}
          style={{
            ...MONO,
            color: "hsl(24 5.4% 52%)",
            textDecoration: "none",
          }}
        >
          ← {venueName ?? "Back"}
        </Link>
        <div style={{ ...MONO, fontSize: 9, color: "hsl(24 5.4% 42%)" }}>
          {step + 1} / {totalSteps}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "oklch(0.75 0.11 44)",
            transition: "width 360ms cubic-bezier(.2,.7,.2,1)",
          }}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "28px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>
          {isNotesStep ? (
            /* Notes step */
            <>
              <div style={{ ...MONO, fontSize: 9, color: "hsl(24 5.4% 40%)", marginBottom: 14 }}>
                Notes
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(24px,4vw,36px)",
                  fontWeight: 400,
                  color: "hsl(60 9.1% 97.8%)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  marginBottom: 20,
                }}
              >
                Any notes to add?
              </h2>

              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="visited_on"
                  style={{ ...MONO, fontSize: 9, color: "hsl(24 5.4% 40%)", display: "block", marginBottom: 8 }}
                >
                  Visited on
                </label>
                <input
                  id="visited_on"
                  name="visited_on"
                  type="date"
                  required
                  defaultValue={today()}
                  max={today()}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.04)",
                    color: "hsl(60 9.1% 97.8%)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    colorScheme: "dark",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="body"
                  style={{ ...MONO, fontSize: 9, color: "hsl(24 5.4% 40%)", display: "block", marginBottom: 8 }}
                >
                  Review
                </label>
                <Textarea
                  id="body"
                  name="body"
                  maxLength={5000}
                  rows={4}
                  placeholder="How was the coffee?"
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.04)",
                    color: "hsl(60 9.1% 97.8%)",
                    fontSize: 14,
                    resize: "vertical",
                  }}
                />
              </div>

              {state.status === "error" && (
                <p style={{ marginTop: 12, fontSize: 13, color: "hsl(0 84.2% 60.2%)" }}>
                  {state.message}
                </p>
              )}
            </>
          ) : (
            /* Rating step */
            <>
              <div style={{ ...MONO, fontSize: 9, color: "hsl(24 5.4% 40%)", marginBottom: 14 }}>
                {currentAxis.label}
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(24px,4vw,36px)",
                  fontWeight: 400,
                  color: "hsl(60 9.1% 97.8%)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  marginBottom: 12,
                }}
              >
                How was the {currentAxis.label.toLowerCase()}?
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "hsl(24 5.4% 52%)",
                  lineHeight: 1.7,
                  marginBottom: 28,
                }}
              >
                {currentAxis.desc}
              </p>

              {/* Score display */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 64,
                    fontWeight: 400,
                    color: "oklch(0.75 0.11 44)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {values[currentAxis.name]}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 16,
                    color: "hsl(24 5.4% 36%)",
                  }}
                >
                  /10
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={1}
                max={10}
                value={values[currentAxis.name]}
                style={{
                  width: "100%",
                  accentColor: "oklch(0.75 0.11 44)",
                  cursor: "pointer",
                  marginBottom: 8,
                }}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [currentAxis.name]: Number(e.target.value),
                  }))
                }
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  ...MONO,
                  fontSize: 9,
                  color: "hsl(24 5.4% 36%)",
                  marginBottom: 14,
                }}
              >
                <span>Poor</span>
                <span>Good</span>
                <span>Exceptional</span>
              </div>

              {/* Travel hint */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  color: "oklch(0.75 0.11 44)",
                  minHeight: 20,
                }}
              >
                {travelHint}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          padding: "14px 24px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "hsl(20 14.3% 4%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
          style={{
            ...MONO,
            height: 36,
            padding: "0 18px",
            background: "transparent",
            color: "hsl(24 5.4% 52%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 2,
            cursor: "pointer",
            opacity: step === 0 || pending ? 0.4 : 1,
          }}
        >
          {step === 0 ? "Cancel" : "← Back"}
        </button>

        {isNotesStep ? (
          <button
            type="submit"
            disabled={pending}
            style={{
              ...MONO,
              height: 36,
              padding: "0 24px",
              background: "oklch(0.75 0.11 44)",
              color: "hsl(20 14.3% 4%)",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? "Posting…" : "Submit review"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
            disabled={pending}
            style={{
              ...MONO,
              height: 36,
              padding: "0 24px",
              background: "oklch(0.75 0.11 44)",
              color: "hsl(20 14.3% 4%)",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            Next →
          </button>
        )}
      </div>
    </form>
  );
}
