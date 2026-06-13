"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Venue } from "@/lib/types";

import {
  updateVenueDetails,
  type VenueFormState,
} from "../../actions";

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

export function VenueDetailsForm({ venue }: { venue: Venue }) {
  const [state, formAction, pending] = useActionState(
    updateVenueDetails,
    initial,
  );

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="slug" value={venue.slug} />

      <div className="grid gap-1.5">
        <Label htmlFor="address_line1">Address</Label>
        <Input
          id="address_line1"
          name="address_line1"
          maxLength={200}
          defaultValue={venue.address_line1 ?? ""}
        />
        <FieldError state={state} field="address_line1" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="address_line2">Address line 2</Label>
        <Input
          id="address_line2"
          name="address_line2"
          maxLength={200}
          defaultValue={venue.address_line2 ?? ""}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://…"
          defaultValue={venue.website ?? ""}
        />
        <FieldError state={state} field="website" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="instagram">Instagram</Label>
        <Input
          id="instagram"
          name="instagram"
          maxLength={60}
          placeholder="@handle"
          defaultValue={venue.instagram ?? ""}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="roasters">Roasters</Label>
        <Input
          id="roasters"
          name="roasters"
          placeholder="Square Mile, Origin"
          defaultValue={venue.roasters.join(", ")}
        />
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Comma-separated.
        </p>
        <FieldError state={state} field="roasters" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="brew_methods">Brew methods</Label>
        <Input
          id="brew_methods"
          name="brew_methods"
          placeholder="espresso, pourover, batch_filter"
          defaultValue={venue.brew_methods.join(", ")}
        />
        <FieldError state={state} field="brew_methods" />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="has_decaf"
            defaultChecked={venue.has_decaf ?? false}
          />
          Decaf available
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="has_plant_milk"
            defaultChecked={venue.has_plant_milk ?? false}
          />
          Plant milk
        </label>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={1000}
          defaultValue={venue.notes ?? ""}
        />
        <FieldError state={state} field="notes" />
      </div>

      {state.status === "error" && !state.fieldErrors ? (
        <p className="text-sm text-[var(--color-destructive)]">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
