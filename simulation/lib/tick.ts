import type { SupabaseClient } from "@supabase/supabase-js";
import { join } from "path";
import { loadAllPersonas, type Persona } from "./persona-loader";
import { computePreference, sampleNoise, consensusPull } from "./preference";
import type { AttributeVector } from "./preference";
import { mapPreferenceToBucket, mapPreferenceToScores } from "./bucket-mapping";
import { writeReview } from "./llm-review-writer";
import { insertSyntheticReview } from "./tournament-injection";

const PERSONAS_DIR = join(__dirname, "../personas");

const DAY_NAMES = [
  "sun", "mon", "tue", "wed", "thu", "fri", "sat",
] as const;

type DayName = (typeof DAY_NAMES)[number];

export type TickResult = {
  agentsActive:    number;
  reviewsGenerated: number;
  totalCostUsd:    number;
  errors:          string[];
};

type ReviewerStateRow = {
  reviewer_id:                 string;
  last_tick_at:                string | null;
  reviews_written:             number;
  current_obsession:           string | null;
  recent_venue_ids:            string[];
  cumulative_prompt_tokens:    number;
  cumulative_completion_tokens: number;
};

type VenueRow = {
  id:              string;
  name:            string;
  notes:           string | null;
  address_line2:   string | null;
  attribute_vector: unknown;
};

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runTick(
  sb: SupabaseClient,
  tickDate: Date = new Date(),
): Promise<TickResult> {
  const personas = loadAllPersonas(PERSONAS_DIR);
  const dayName = DAY_NAMES[tickDate.getDay()] as DayName;

  const reviewerByPersonaId = await loadReviewerIndex(sb);

  let agentsActive    = 0;
  let reviewsGenerated = 0;
  let totalCostUsd    = 0;
  const errors: string[] = [];

  for (const persona of personas) {
    try {
      if (!isActiveDay(persona, dayName)) continue;
      if (!shouldReviewToday(persona)) continue;

      const reviewerId = reviewerByPersonaId.get(persona.id);
      if (!reviewerId) {
        errors.push(`No reviewer row found for persona ${persona.id}`);
        continue;
      }

      agentsActive++;

      const agentState = await loadAgentState(sb, reviewerId);
      const venue = await pickVenue(sb, persona, reviewerId, agentState.recent_venue_ids, tickDate);
      if (!venue) continue;

      const attrVector = venue.attribute_vector as AttributeVector;
      const venueScore = await loadVenueScore(sb, venue.id);

      // Preference computation: dot product + noise + consensus pull.
      const rawPref =
        computePreference(persona.taste_vector, attrVector)
        + sampleNoise(persona.calibration.noise)
        + consensusPull(venueScore, persona.calibration.conformity);
      const pref = Math.max(-1, Math.min(1, rawPref));

      const bucket  = mapPreferenceToBucket(pref, persona);
      const scores  = mapPreferenceToScores(pref, bucket, persona, attrVector);

      const recentSnippets = await loadRecentSnippets(sb, reviewerId);

      const { body, promptTokens, completionTokens } = await writeReview({
        persona,
        venueName:        venue.name,
        venueDescription: venue.notes ?? "",
        neighbourhood:    venue.address_line2 ?? "",
        scores,
        currentObsession: agentState.current_obsession,
        recentSnippets,
      });

      const visitedOn = tickDate.toISOString().split("T")[0];
      await insertSyntheticReview(sb, {
        reviewerId,
        venueId:         venue.id,
        bucket,
        coffee_5:        scores.coffee_5,
        vibe_5:          scores.vibe_5,
        body,
        visitedOn,
        preferenceScore: (pref + 1) / 2,
      });

      reviewsGenerated++;
      const costUsd = (promptTokens * 0.075 + completionTokens * 0.30) / 1_000_000;
      totalCostUsd += costUsd;

      await updateAgentState(sb, reviewerId, agentState, venue.id, promptTokens, completionTokens);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Persona ${persona.id}: ${msg}`);
    }
  }

  await sb.from("simulation_ticks").insert({
    tick_at:           tickDate.toISOString(),
    agents_active:     agentsActive,
    reviews_generated: reviewsGenerated,
    total_cost_usd:    totalCostUsd,
    notes:             errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
  });

  return { agentsActive, reviewsGenerated, totalCostUsd, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadReviewerIndex(
  sb: SupabaseClient,
): Promise<Map<string, string>> {
  const { data, error } = await sb
    .from("reviewers")
    .select("id, persona_yaml")
    .eq("is_synthetic", true);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.persona_yaml) continue;
    try {
      const parsed = JSON.parse(row.persona_yaml) as { id: string };
      map.set(parsed.id, row.id);
    } catch {
      // Skip malformed entries.
    }
  }
  return map;
}

async function loadAgentState(
  sb: SupabaseClient,
  reviewerId: string,
): Promise<ReviewerStateRow> {
  const { data } = await sb
    .from("agent_state")
    .select("*")
    .eq("reviewer_id", reviewerId)
    .single();
  return (
    data ?? {
      reviewer_id:                  reviewerId,
      last_tick_at:                 null,
      reviews_written:              0,
      current_obsession:            null,
      recent_venue_ids:             [],
      cumulative_prompt_tokens:     0,
      cumulative_completion_tokens: 0,
    }
  );
}

function isActiveDay(persona: Persona, day: DayName): boolean {
  return persona.activity.active_days.includes(day);
}

function shouldReviewToday(persona: Persona): boolean {
  const dailyP = persona.activity.reviews_per_week_mean / 7;
  return Math.random() < dailyP;
}

async function pickVenue(
  sb: SupabaseClient,
  persona: Persona,
  reviewerId: string,
  recentVenueIds: string[],
  tickDate: Date,
): Promise<VenueRow | null> {
  const visitedOn = tickDate.toISOString().split("T")[0];

  // Venues reviewed by this persona today (shouldn't happen in daily cron, but
  // guard it for bootstrap where the same persona may appear twice).
  const { data: todayRows } = await sb
    .from("reviews")
    .select("venue_id")
    .eq("reviewer_id", reviewerId)
    .eq("visited_on", visitedOn);
  const todayVenueIds = (todayRows ?? []).map((r: { venue_id: string }) => r.venue_id);

  const exclusions = [...new Set([...recentVenueIds, ...todayVenueIds])];

  const baseQuery = () => {
    let q = sb
      .from("venues")
      .select("id, name, notes, address_line2, attribute_vector")
      .eq("is_fictional", true)
      .eq("city", "bramford");
    if (exclusions.length > 0) {
      q = q.not("id", "in", `(${exclusions.join(",")})`);
    }
    return q;
  };

  const roll = Math.random();

  // 70%: prefer persona's neighbourhood.
  if (roll < 0.70) {
    const { data } = await baseQuery()
      .ilike("address_line2", `%${persona.neighbourhood}%`)
      .limit(20);
    if (data && data.length > 0) {
      return data[Math.floor(Math.random() * data.length)] as VenueRow;
    }
  }

  // 20%: top-rated "buzz" venues.
  if (roll < 0.90) {
    const { data: topVenues } = await sb
      .from("venue_axis_scores")
      .select("venue_id")
      .eq("axis", "overall")
      .order("score", { ascending: false })
      .limit(15);
    const topIds = (topVenues ?? []).map((v: { venue_id: string }) => v.venue_id);
    if (topIds.length > 0) {
      const { data } = await baseQuery().in("id", topIds).limit(10);
      if (data && data.length > 0) {
        return data[Math.floor(Math.random() * data.length)] as VenueRow;
      }
    }
  }

  // 10%: random fallback.
  const { data } = await baseQuery().limit(50);
  if (!data || data.length === 0) return null;
  return data[Math.floor(Math.random() * data.length)] as VenueRow;
}

async function loadVenueScore(
  sb: SupabaseClient,
  venueId: string,
): Promise<number | null> {
  const { data } = await sb
    .from("venue_axis_scores")
    .select("score")
    .eq("venue_id", venueId)
    .eq("axis", "overall")
    .single();
  return data ? Number(data.score) : null;
}

async function loadRecentSnippets(
  sb: SupabaseClient,
  reviewerId: string,
): Promise<string[]> {
  const { data } = await sb
    .from("reviews")
    .select("body")
    .eq("reviewer_id", reviewerId)
    .eq("is_synthetic", true)
    .order("created_at", { ascending: false })
    .limit(3);
  return (data ?? []).map((r: { body: string }) => r.body.slice(0, 150));
}

async function updateAgentState(
  sb: SupabaseClient,
  reviewerId: string,
  current: ReviewerStateRow,
  venueId: string,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  const updatedRecentVenues = [venueId, ...current.recent_venue_ids].slice(0, 5);
  await sb.from("agent_state").upsert(
    {
      reviewer_id:                  reviewerId,
      last_tick_at:                 new Date().toISOString(),
      reviews_written:              current.reviews_written + 1,
      recent_venue_ids:             updatedRecentVenues,
      cumulative_prompt_tokens:     current.cumulative_prompt_tokens + promptTokens,
      cumulative_completion_tokens: current.cumulative_completion_tokens + completionTokens,
    },
    { onConflict: "reviewer_id" },
  );
}
