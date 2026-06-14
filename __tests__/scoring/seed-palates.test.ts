import { describe, expect, it } from "vitest";

import {
  SEED_PALATES,
  isSeedPalate,
  validateSeedPalates,
  type SeedPalate,
} from "@/lib/scoring/seed-palates";

const ok: SeedPalate = {
  username: "mira",
  justification: "SCA Q-grader; 8 years roastery QC.",
  designatedOn: "2026-06-14",
};

describe("validateSeedPalates", () => {
  it("accepts the shipped (empty) registry", () => {
    expect(() => validateSeedPalates()).not.toThrow();
  });

  it("accepts a well-formed entry", () => {
    expect(validateSeedPalates([ok])).toEqual([ok]);
  });

  it("rejects an entry with no justification — every designation must say why", () => {
    expect(() =>
      validateSeedPalates([{ ...ok, justification: "  " }]),
    ).toThrow(/justification/i);
  });

  it("rejects a missing username", () => {
    expect(() => validateSeedPalates([{ ...ok, username: "" }])).toThrow(
      /username/i,
    );
  });

  it("rejects a malformed date", () => {
    expect(() =>
      validateSeedPalates([{ ...ok, designatedOn: "June 2026" }]),
    ).toThrow(/designatedOn/i);
  });

  it("rejects duplicate usernames (case-insensitive)", () => {
    expect(() =>
      validateSeedPalates([ok, { ...ok, username: "MIRA" }]),
    ).toThrow(/duplicate/i);
  });
});

describe("isSeedPalate", () => {
  const palates: SeedPalate[] = [ok];

  it("matches case-insensitively", () => {
    expect(isSeedPalate("mira", palates)).toBe(true);
    expect(isSeedPalate("MIRA", palates)).toBe(true);
    expect(isSeedPalate(" Mira ", palates)).toBe(true);
  });

  it("returns false for non-members and nullish input", () => {
    expect(isSeedPalate("someone-else", palates)).toBe(false);
    expect(isSeedPalate(null, palates)).toBe(false);
    expect(isSeedPalate(undefined, palates)).toBe(false);
  });

  it("defaults to the shipped registry (no one crowned by default)", () => {
    expect(SEED_PALATES.length).toBe(0);
    expect(isSeedPalate("anyone")).toBe(false);
  });
});
