"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Reviewer } from "@/lib/types";
import { updateProfile, type ProfileFormState } from "@/app/profile/actions";

type Props = {
  reviewer: Reviewer;
};

const initial: ProfileFormState = { status: "idle" };

export function EditProfileForm({ reviewer }: Props) {
  const [state, action, pending] = useActionState(updateProfile, initial);

  const fieldError = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={action} style={{ display: "grid", gap: 20 }}>
      {state.status === "error" && !state.fieldErrors && (
        <p
          style={{
            fontSize: 13,
            color: "var(--color-destructive)",
            padding: "10px 14px",
            border: "1px solid var(--color-destructive)",
            borderRadius: "var(--radius)",
          }}
        >
          {state.message}
        </p>
      )}

      <FieldGroup
        label="Display name"
        htmlFor="display_name"
        error={fieldError("display_name")}
        required
      >
        <Input
          id="display_name"
          name="display_name"
          defaultValue={reviewer.display_name}
          maxLength={60}
          required
        />
      </FieldGroup>

      <FieldGroup
        label="Username"
        htmlFor="username"
        hint="Lowercase letters, numbers, underscores or hyphens. Shown as @handle."
        error={fieldError("username")}
      >
        <Input
          id="username"
          name="username"
          defaultValue={reviewer.username ?? ""}
          maxLength={30}
          placeholder="e.g. coffeehound"
        />
      </FieldGroup>

      <FieldGroup
        label="Home city"
        htmlFor="home_city"
        error={fieldError("home_city")}
      >
        <Input
          id="home_city"
          name="home_city"
          defaultValue={reviewer.home_city ?? ""}
          maxLength={80}
          placeholder="e.g. London"
        />
      </FieldGroup>

      <FieldGroup
        label="Bio"
        htmlFor="bio"
        hint="Up to 300 characters."
        error={fieldError("bio")}
      >
        <Textarea
          id="bio"
          name="bio"
          defaultValue={reviewer.bio ?? ""}
          maxLength={300}
          rows={3}
          placeholder="e.g. Espresso-first, North London regular, filter obsessive"
        />
      </FieldGroup>

      <FieldGroup
        label="Avatar URL"
        htmlFor="avatar_url"
        hint="Link to a public image. Leave blank to use initials."
        error={fieldError("avatar_url")}
      >
        <Input
          id="avatar_url"
          name="avatar_url"
          type="url"
          defaultValue={reviewer.avatar_url ?? ""}
          maxLength={500}
          placeholder="https://..."
        />
      </FieldGroup>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function FieldGroup({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span
            style={{ color: "var(--color-destructive)", marginLeft: 3 }}
            aria-hidden="true"
          >
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 12, color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
