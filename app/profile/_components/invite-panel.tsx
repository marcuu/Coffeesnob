"use client";

import { useActionState } from "react";

import type { InviteActivityItem } from "@/app/profile/_lib/fetch-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvite, type InviteFormState } from "@/app/profile/invite-actions";
import { formatRelativeDate } from "@/lib/profile";

const initialState: InviteFormState = { status: "idle" };

type Props = {
  weeklyLimit: number;
  remainingThisWeek: number;
  isHighSignal: boolean;
  activity: InviteActivityItem[];
  nowIso: string;
  isOwnProfile: boolean;
};

export function InvitePanel({
  weeklyLimit,
  remainingThisWeek,
  isHighSignal,
  activity,
  nowIso,
  isOwnProfile,
}: Props) {
  const [state, formAction, pending] = useActionState(createInvite, initialState);
  const now = new Date(nowIso);
  const visibleActivity = isOwnProfile
    ? activity
    : activity.filter((item) => item.status === "accepted");

  return (
    <section
      style={{
        padding: "20px 22px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-background)",
        marginBottom: 36,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-muted-foreground)",
          margin: 0,
        }}
      >
        Invites
      </h2>

      <p style={{ fontSize: 13, marginTop: 8, marginBottom: 10 }}>
        {remainingThisWeek}/{weeklyLimit} invites left this week
        {isHighSignal ? " · High-signal boost active" : ""}.
      </p>

      {isOwnProfile && (
        <form action={formAction} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="invite-email">Invite by email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="friend@example.com"
            />
          </div>
          <Button type="submit" disabled={pending || remainingThisWeek <= 0}>
            {pending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      )}

      {isOwnProfile && state.message ? (
        <p
          className={
            state.status === "error"
              ? "mb-3 text-sm text-[var(--color-destructive)]"
              : "mb-3 text-sm text-[var(--color-muted-foreground)]"
          }
        >
          {state.message}
        </p>
      ) : null}

      <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
        {visibleActivity.length === 0 && (
          <li style={{ fontSize: 13, color: "var(--color-muted-foreground)" }}>
            No invite activity yet.
          </li>
        )}
        {visibleActivity.map((item) => {
          const invitee = item.inviteeUsername
            ? `@${item.inviteeUsername}`
            : item.inviteeDisplayName ?? item.inviteeMask;
          const action = item.status === "accepted" ? "invited" : "invited (pending)";
          const timestamp = formatRelativeDate(item.acceptedAt ?? item.createdAt, now);

          return (
            <li key={item.id} style={{ fontSize: 13, color: "var(--color-foreground)" }}>
              {action} {invitee} · {timestamp}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
