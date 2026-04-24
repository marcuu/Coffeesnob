"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createReview, type ReviewFormState } from "./actions";

const initial: ReviewFormState = { status: "idle" };

const AXES = [
  { name: "rating_ambience", label: "Ambience" },
  { name: "rating_service", label: "Service" },
  { name: "rating_value", label: "Value" },
  { name: "rating_taste", label: "Taste" },
  { name: "rating_body", label: "Body" },
  { name: "rating_aroma", label: "Aroma" },
] as const;

const DEFAULT_RATING = 5;
const MAX_STEP = AXES.length - 1;
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
      router.push(`/venues/${slug}`);
    }
  }, [state.status, router, slug]);

  const currentAxis = AXES[step];
  const progress = ((step + 1) / AXES.length) * 100;

  return (
    <form ref={formRef} action={formAction} className="grid gap-6">
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="slug" value={slug} />
      {AXES.map(({ name }) => (
        <input key={name} type="hidden" name={name} value={values[name]} />
      ))}

      <div className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Step {step + 1} of {AXES.length}: {currentAxis.label}
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {values[currentAxis.name]}/10
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-2">
          {AXES.map((axis, axisIndex) => (
            <span
              key={axis.name}
              className="h-2 flex-1 rounded-full"
              style={{
                backgroundColor:
                  axisIndex <= step
                    ? "var(--color-primary)"
                    : "var(--color-border)",
              }}
            />
          ))}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={currentAxis.name}>{currentAxis.label}</Label>
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
        </div>

        <ul className="grid gap-1 text-xs text-[var(--color-muted-foreground)]">
          {RATING_GUIDE.map((guide) => (
            <li key={guide.score}>
              <span className="font-medium">{guide.score}</span> — {guide.note}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={() => setStep((s) => Math.min(MAX_STEP, s + 1))}
            disabled={step === MAX_STEP || pending}
          >
            Next step
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="visited_on">Visited on</Label>
        <Input
          id="visited_on"
          name="visited_on"
          type="date"
          required
          defaultValue={today()}
          max={today()}
          className="max-w-[200px]"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="body">Review</Label>
        <Textarea
          id="body"
          name="body"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          placeholder="How was the coffee?"
        />
      </div>

      {state.status === "error" ? (
        <p className="text-sm text-[var(--color-destructive)]">{state.message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={`/venues/${slug}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post review"}
        </Button>
      </div>
    </form>
  );
}
