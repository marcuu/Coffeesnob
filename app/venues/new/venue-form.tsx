"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createVenue, type VenueFormState } from "../actions";

const initial: VenueFormState = { status: "idle" };

function FieldError({
  state,
  field,
}: {
  state: VenueFormState;
  field: string;
}) {
  if (state.status !== "error" || !state.fieldErrors?.[field]) return null;
  return (
    <p className="text-xs text-[var(--color-destructive)]">
      {state.fieldErrors[field]}
    </p>
  );
}

// Three fields. The slug is derived, the postcode is geocoded, and the rest
// can be added from the venue page afterwards.
export function VenueForm() {
  const [state, formAction, pending] = useActionState(createVenue, initial);
  const vals = state.status === "error" ? state.values : undefined;

  return (
    <form
      key={state.status === "error" ? (state._key ?? 0) : 0}
      action={formAction}
      className="grid gap-5"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder="Prufrock Coffee"
          defaultValue={vals?.name}
        />
        <FieldError state={state} field="name" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          name="city"
          required
          maxLength={80}
          placeholder="London"
          defaultValue={vals?.city}
        />
        <FieldError state={state} field="city" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="postcode">Postcode</Label>
        <Input
          id="postcode"
          name="postcode"
          required
          maxLength={10}
          placeholder="EC1N 7TE"
          defaultValue={vals?.postcode}
        />
        <FieldError state={state} field="postcode" />
      </div>

      {state.status === "error" && !state.fieldErrors ? (
        <p className="text-sm text-[var(--color-destructive)]">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Adding…" : "Add venue"}
      </Button>
    </form>
  );
}
