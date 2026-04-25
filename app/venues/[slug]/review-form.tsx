"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createReview, type ReviewFormState } from "./actions";

const initial: ReviewFormState = { status: "idle" };

const AXES = [
  { name: "rating_ambience", label: "Ambience", prompt: "How did the space feel while you were there?" },
  { name: "rating_service", label: "Service", prompt: "How thoughtful and welcoming was the service?" },
  { name: "rating_value", label: "Value", prompt: "Did quality match what you paid?" },
  { name: "rating_taste", label: "Taste", prompt: "How good was the flavour in the cup?" },
  { name: "rating_body", label: "Body", prompt: "How satisfying was the texture and mouthfeel?" },
  { name: "rating_aroma", label: "Aroma", prompt: "How expressive was the coffee aroma?" },
] as const;

const DEFAULT_RATING = 5;
const RATING_STEP_COUNT = AXES.length;
const TOTAL_STEPS = RATING_STEP_COUNT + 2;
const MAX_STEP = TOTAL_STEPS - 1;
const RATING_GUIDE = [
  { score: "5/10", note: "Good for third-wave coffee." },
  { score: "7/10", note: "Worth travelling 30 minutes for." },
  { score: "8/10", note: "Worth travelling 60 minutes for." },
  { score: "9/10", note: "Worth travelling 3 hours for." },
] as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReviewForm({
  venueId,
  slug,
}: {
  venueId: string;
  slug: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createReview, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [visitedOn, setVisitedOn] = useState(today());
  const [body, setBody] = useState("");
  const [values, setValues] = useState<Record<(typeof AXES)[number]["name"], number>>({
    rating_ambience: DEFAULT_RATING,
    rating_service: DEFAULT_RATING,
    rating_value: DEFAULT_RATING,
    rating_taste: DEFAULT_RATING,
    rating_body: DEFAULT_RATING,
    rating_aroma: DEFAULT_RATING,
  });

  useEffect(() => {
    if (state.status === "success") {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        router.push(`/venues/${slug}`);
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [state.status, router, slug]);

  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const ratingStepIndex = step < RATING_STEP_COUNT ? step : -1;
  const currentAxis = ratingStepIndex >= 0 ? AXES[ratingStepIndex] : null;
  const visibleGuide =
    ratingStepIndex >= 0
      ? RATING_GUIDE.slice(0, Math.min(RATING_GUIDE.length, ratingStepIndex + 1))
      : [];

  const canContinue = useMemo(() => {
    if (step < RATING_STEP_COUNT) return true;
    if (step === RATING_STEP_COUNT) return Boolean(visitedOn);

    return body.trim().length >= 10;
  }, [body, step, visitedOn]);

  const isLastStep = step === MAX_STEP;

  return (
    <form ref={formRef} action={formAction} className="grid gap-6">
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="visited_on" value={visitedOn} />
      <input type="hidden" name="body" value={body} />
      {AXES.map(({ name }) => (
        <input key={name} type="hidden" name={name} value={values[name]} />
      ))}

      <div className="grid gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Step {step + 1} of {TOTAL_STEPS}</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {currentAxis ? `${values[currentAxis.name]}/10` : null}
          </p>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }).map((_, axisIndex) => {
            const isScoringAxis = axisIndex < RATING_STEP_COUNT;
            return (
              <span
                key={axisIndex}
                className={`h-2 rounded-full transition-colors ${
                  isScoringAxis ? "flex-1" : "w-12"
                }`}
                style={{
                  backgroundColor:
                    axisIndex <= step
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                }}
              />
            );
          })}
        </div>

        {currentAxis ? (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor={currentAxis.name} className="text-base font-semibold">
                {currentAxis.label}
              </Label>
              <p className="text-sm text-[var(--color-muted-foreground)]">{currentAxis.prompt}</p>
            </div>
            <Input
              id={currentAxis.name}
              type="range"
              min={1}
              max={10}
              step={1}
              value={values[currentAxis.name]}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [currentAxis.name]: Number(e.target.value),
                }))
              }
            />
            <ul className="grid gap-1 text-xs text-[var(--color-muted-foreground)]">
              {visibleGuide.map((guide) => (
                <li key={guide.score}>
                  <span className="font-medium">{guide.score}</span> — {guide.note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === RATING_STEP_COUNT ? (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="visited_on" className="text-base font-semibold">
                When did you visit?
              </Label>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Add the date so this review lines up with your visit.
              </p>
            </div>
            <Input
              id="visited_on"
              type="date"
              required
              value={visitedOn}
              max={today()}
              onChange={(e) => setVisitedOn(e.target.value)}
              className="max-w-[220px]"
            />
          </div>
        ) : null}

        {step === RATING_STEP_COUNT + 1 ? (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="body" className="text-base font-semibold">
                Tell us about your visit
              </Label>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Helpful prompts: how busy it usually gets, standout coffees, and who you&apos;d recommend this venue to.
              </p>
            </div>
            <Textarea
              id="body"
              required
              minLength={10}
              maxLength={5000}
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share what you ordered, when it is best to visit, and any drink recommendations."
            />
            <p className="text-xs text-[var(--color-muted-foreground)]">{body.length}/5000</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
          >
            Back
          </Button>

          {isLastStep ? (
            <Button type="submit" disabled={pending || !canContinue}>
              {pending ? "Posting…" : "Post review"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(MAX_STEP, s + 1))}
              disabled={!canContinue || pending}
            >
              Continue
            </Button>
          )}
        </div>
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-[var(--color-destructive)]">{state.message}</p>
      ) : null}

      {showSuccess ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <span className="inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-500" aria-hidden />
          Review posted — taking you back to the venue page.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" asChild>
          <Link href={`/venues/${slug}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
