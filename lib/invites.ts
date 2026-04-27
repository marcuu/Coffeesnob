import type { Reviewer } from "@/lib/types";

export const WEEKLY_INVITE_LIMIT = {
  base: 3,
  highSignal: 5,
} as const;

export function isHighSignalReviewer(
  reviewer: Pick<Reviewer, "status" | "review_count">,
): boolean {
  return reviewer.status === "beaned" || reviewer.review_count >= 20;
}

export function getWeeklyInviteLimit(
  reviewer: Pick<Reviewer, "status" | "review_count">,
): number {
  return isHighSignalReviewer(reviewer)
    ? WEEKLY_INVITE_LIMIT.highSignal
    : WEEKLY_INVITE_LIMIT.base;
}

export function startOfUtcWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function maskInviteeEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return "hidden";
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}
