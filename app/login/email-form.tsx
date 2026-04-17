"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  loginWithEmail,
  type EmailLoginState,
} from "./actions";

const initialState: EmailLoginState = { status: "idle" };

export function EmailLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginWithEmail,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Send magic link"}
      </Button>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-sm text-[var(--color-destructive)]"
              : "text-sm text-[var(--color-muted-foreground)]"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
