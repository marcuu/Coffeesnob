// Workstream E — Option A: seed trusted palates.
//
// At n≈25 with no history, the model cannot yet identify good palates, so we
// hand-pick a seed set and "crown" them as `beaned` (the anchor tier, base
// weight 3.0 — see SCORING_CONSTANTS.STATUS_BASE_WEIGHT). Their status anchors
// scores from day one (computeReviewWeight bypasses the new-account
// tenure/consistency penalty for `beaned` reviewers).
//
// This module is the *mechanism* — an auditable, rule-based registry — not the
// selection RULE. Per PRD §13.1 / E2 the rule (who is crowned, by what stated
// criteria) is Marcus's values call and is documented in docs/seed-palates.md;
// it is deliberately NOT invented here.
//
// Each entry MUST record *why* the palate was crowned (E1/E3): no reviewer may
// be silently privileged outside this list. Seed status is intended to be
// transitional — measured credibility (Workstream F: predictive validity +
// inter-rater agreement) should take over as data accrues — so this registry
// is a bootstrap, not a permanent clique. Re-derivation from data is a planned
// follow-up; until then, designations are reviewed against the documented rule.

export type SeedPalate = {
  /**
   * The reviewer's username — the stable handle used to resolve the row when
   * applying designations. Must match `reviewers.username`.
   */
  username: string;
  /**
   * The STATED justification for crowning this palate, recorded for audit.
   * This is the per-reviewer instance of the selection rule (E1/E3). Keep it
   * specific and falsifiable (e.g. "Q-grader; 8yr roastery QC") — not "trusted".
   */
  justification: string;
  /** ISO date (YYYY-MM-DD) the designation was made. */
  designatedOn: string;
};

// The launch seed set. Empty by default: populated by Marcus once the
// selection rule is fixed (docs/seed-palates.md). Adding an entry here, then
// running `npm run scoring:seed-palates`, is the ONLY sanctioned way to grant
// anchor status.
export const SEED_PALATES: readonly SeedPalate[] = [];

/** Normalises a username for case-insensitive matching. */
function normalise(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Validates the registry, throwing on any malformed or duplicate entry so a
 * bad designation can never be silently applied. Returns the entries on
 * success. Call before applying designations.
 */
export function validateSeedPalates(
  palates: readonly SeedPalate[] = SEED_PALATES,
): readonly SeedPalate[] {
  const seen = new Set<string>();
  for (const p of palates) {
    if (!p.username || !p.username.trim()) {
      throw new Error("Seed palate is missing a username.");
    }
    if (!p.justification || !p.justification.trim()) {
      throw new Error(
        `Seed palate "${p.username}" is missing a justification — every ` +
          "designation must record why (PRD Workstream E1/E3).",
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.designatedOn)) {
      throw new Error(
        `Seed palate "${p.username}" has an invalid designatedOn (expected YYYY-MM-DD).`,
      );
    }
    const key = normalise(p.username);
    if (seen.has(key)) {
      throw new Error(`Duplicate seed palate for username "${p.username}".`);
    }
    seen.add(key);
  }
  return palates;
}

/** True if the given username is a designated seed palate. */
export function isSeedPalate(
  username: string | null | undefined,
  palates: readonly SeedPalate[] = SEED_PALATES,
): boolean {
  if (!username) return false;
  const key = normalise(username);
  return palates.some((p) => normalise(p.username) === key);
}
