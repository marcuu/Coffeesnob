"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
  const [state, formAction, pending] = useActionState(createReview, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<(typeof AXES)[number]["name"], number>>({
    rating_ambience: 5,
    rating_service: 5,
    rating_value: 5,
    rating_taste: 5,
    rating_body: 5,
    rating_aroma: 5,
  });

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setValues({
        rating_ambience: 5,
        rating_service: 5,
        rating_value: 5,
        rating_taste: 5,
        rating_body: 5,
        rating_aroma: 5,
      });
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-3 sm:grid-cols-2">
        {AXES.map(({ name, label }) => (
          <div key={name} className="grid gap-1.5">
            <Label htmlFor={name} className="flex items-center justify-between">
              <span>{label}</span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {values[name]}/10
              </span>
            </Label>
            <Input
              id={name}
              name={name}
              type="range"
              min={1}
              max={10}
              step={1}
              required
              defaultValue={5}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [name]: Number(e.target.value) }))
              }
            />
          </div>
        ))}
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
      {state.status === "success" ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Review posted.</p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post review"}
        </Button>
      </div>
    </form>
  );
}
