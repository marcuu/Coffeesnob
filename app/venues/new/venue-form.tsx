"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BREW_METHODS } from "@/lib/validators";

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
        <Input id="name" name="name" required maxLength={120} defaultValue={vals?.name} />
        <FieldError state={state} field="name" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          placeholder="prufrock-coffee"
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          defaultValue={vals?.slug}
        />
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Used in the URL. Lowercase letters, numbers and hyphens.
        </p>
        <FieldError state={state} field="slug" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="address_line1">Address</Label>
        <Input
          id="address_line1"
          name="address_line1"
          required
          defaultValue={vals?.address_line1}
        />
        <Input
          id="address_line2"
          name="address_line2"
          placeholder="Address line 2 (optional)"
          defaultValue={vals?.address_line2}
        />
        <FieldError state={state} field="address_line1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required placeholder="e.g. Leeds, London" defaultValue={vals?.city} />
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Yorkshire: Leeds, Sheffield, York, Huddersfield, Harrogate, Holmfirth, Wakefield.
          </p>
          <FieldError state={state} field="city" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="postcode">Postcode</Label>
          <Input id="postcode" name="postcode" required defaultValue={vals?.postcode} />
          <FieldError state={state} field="postcode" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="website">
          Website <span className="text-[var(--color-muted-foreground)] font-normal">(optional)</span>
        </Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://…"
          defaultValue={vals?.website}
        />
        <FieldError state={state} field="website" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="roasters">Roasters</Label>
        <Input
          id="roasters"
          name="roasters"
          placeholder="Square Mile, Workshop"
          defaultValue={vals?.roasters}
        />
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Comma-separated.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="brew_methods">Brew methods</Label>
        <Input
          id="brew_methods"
          name="brew_methods"
          placeholder={BREW_METHODS.join(", ")}
          defaultValue={vals?.brew_methods}
        />
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Comma-separated. Allowed: {BREW_METHODS.join(", ")}.
        </p>
        <FieldError state={state} field="brew_methods" />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="has_decaf" defaultChecked={vals?.has_decaf === "on"} />
          Decaf
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="has_plant_milk" defaultChecked={vals?.has_plant_milk === "on"} />
          Plant milk
        </label>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" maxLength={1000} defaultValue={vals?.notes} />
      </div>

      {state.status === "error" && !state.fieldErrors ? (
        <p className="text-sm text-[var(--color-destructive)]">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add venue"}
        </Button>
      </div>
    </form>
  );
}
