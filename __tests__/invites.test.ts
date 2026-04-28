import { describe, expect, it } from "vitest";

import {
  getWeeklyInviteLimit,
  isHighSignalReviewer,
  maskInviteeEmail,
  startOfUtcWeek,
} from "@/lib/invites";

describe("invite quota helpers", () => {
  it("uses base weekly invites for regular reviewers", () => {
    expect(getWeeklyInviteLimit({ status: "active", review_count: 6 })).toBe(3);
    expect(getWeeklyInviteLimit({ status: "invited", review_count: 19 })).toBe(3);
  });

  it("boosts to high-signal weekly invites for beaned or prolific reviewers", () => {
    expect(getWeeklyInviteLimit({ status: "beaned", review_count: 1 })).toBe(5);
    expect(getWeeklyInviteLimit({ status: "active", review_count: 20 })).toBe(5);
    expect(isHighSignalReviewer({ status: "active", review_count: 20 })).toBe(true);
  });

  it("computes week start at monday 00:00 UTC", () => {
    expect(startOfUtcWeek(new Date("2026-04-27T14:31:00.000Z"))).toBe(
      "2026-04-27T00:00:00.000Z",
    );
    expect(startOfUtcWeek(new Date("2026-04-26T23:59:00.000Z"))).toBe(
      "2026-04-20T00:00:00.000Z",
    );
  });

  it("masks invitee email for public display", () => {
    expect(maskInviteeEmail("james@example.com")).toBe("ja***@example.com");
    expect(maskInviteeEmail("ab@example.com")).toBe("a*@example.com");
  });
});
