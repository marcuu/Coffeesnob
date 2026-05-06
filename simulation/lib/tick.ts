import type { SupabaseClient } from "@supabase/supabase-js";

import { persistRankedReview } from "@/lib/reviews/ranked-review-persistence";
import type { ReviewBucket } from "@/lib/types";

import { mapPreferenceToBucket } from "./bucket-mapping";
import { computePreference } from "./preference";
import { SeededRng } from "./rng";
import { buildSyntheticComparisonHistory } from "./tournament-injection";
import type { AttributeVector, Persona, VenueSeed } from "./types";
import { writeReview } from "./llm-review-writer";

export type TickReport = {
  tickAt: string;
  agentsActive: number;
  reviewsGenerated: number;
  totalCostUsd: number;
  notes: string[];
};

type AgentRow = {
  id: string;
  persona_yaml: string | null;
  agent_state?: Array<{
    current_obsession: string | null;
    recent_venue_ids: string[] | null;
  }> | null;
};

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  neighbourhood: string;
  category: string;
  prompt_description: string;
  attribute_vector: AttributeVector;
};

const MONTHLY_CAP = 20;

function dayKey(date: Date): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getUTCDay()];
}

async function currentMonthCost(supabase: SupabaseClient, now: Date): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { data, error } = await supabase
    .from("simulation_ticks")
    .select("total_cost_usd")
    .gte("tick_at", start.toISOString());
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.total_cost_usd ?? 0), 0);
}

async function loadAgents(supabase: SupabaseClient): Promise<Array<{ reviewerId: string; persona: Persona; state: AgentRow["agent_state"] }>> {
  const { data, error } = await supabase
    .from("reviewers")
    .select("id, persona_yaml, agent_state(current_obsession, recent_venue_ids)")
    .eq("is_synthetic", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as AgentRow[])
    .filter((r) => r.persona_yaml)
    .map((r) => ({ reviewerId: r.id, persona: JSON.parse(r.persona_yaml!) as Persona, state: r.agent_state }));
}

async function loadVenues(supabase: SupabaseClient): Promise<VenueRow[]> {
  const { data, error } = await supabase
    .from("venues")
    .select("id, slug, name, simulation_venue_profiles(neighbourhood, category, prompt_description, attribute_vector)")
    .eq("is_fictional", true);
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    simulation_venue_profiles?: Array<{
      neighbourhood: string;
      category: string;
      prompt_description: string;
      attribute_vector: AttributeVector;
    }> | null;
  }>).flatMap((v) => {
    const profile = v.simulation_venue_profiles?.[0];
    if (!profile) return [];
    return [{ id: v.id, slug: v.slug, name: v.name, ...profile }];
  });
}

function shouldRun(persona: Persona, now: Date, rng: SeededRng): boolean {
  if (!persona.activity.active_days.includes(dayKey(now) as never)) return false;
  const p = Math.min(0.95, persona.activity.reviews_per_week_mean / persona.activity.active_days.length);
  return rng.next() < p;
}

function chooseVenue(persona: Persona, venues: VenueRow[], recent: string[], rng: SeededRng): VenueRow {
  const available = venues.filter((v) => !recent.includes(v.id));
  const pool = available.length > 0 ? available : venues;
  const local = pool.filter((v) => v.neighbourhood === persona.neighbourhood);
  if (local.length > 0 && rng.next() < 0.7) return rng.pick(local);
  return rng.pick(pool);
}

export async function runSimulationTick(
  supabase: SupabaseClient,
  options: { now?: Date; seed?: string } = {},
): Promise<TickReport> {
  const now = options.now ?? new Date();
  const tickAt = now.toISOString();
  const notes: string[] = [];
  const spent = await currentMonthCost(supabase, now);
  if (spent >= Number(process.env.SIMULATION_MONTHLY_COST_CAP_USD ?? MONTHLY_CAP)) {
    notes.push("monthly cost cap reached");
    await supabase.from("simulation_ticks").insert({ tick_at: tickAt, notes: notes.join("; ") });
    return { tickAt, agentsActive: 0, reviewsGenerated: 0, totalCostUsd: 0, notes };
  }

  const [agents, venues] = await Promise.all([loadAgents(supabase), loadVenues(supabase)]);
  let agentsActive = 0;
  let reviewsGenerated = 0;
  let totalCostUsd = 0;

  for (const agent of agents) {
    const rng = new SeededRng(`${options.seed ?? tickAt}:${agent.persona.id}`);
    if (!shouldRun(agent.persona, now, rng)) continue;
    agentsActive++;

    const state = Array.isArray(agent.state) ? agent.state[0] : null;
    const recent = state?.recent_venue_ids ?? [];
    const venue = chooseVenue(agent.persona, venues, recent, rng);
    const preference = computePreference(agent.persona, venue.attribute_vector, rng, null);
    const mapping = mapPreferenceToBucket(agent.persona, preference);
    const reviewText = await writeReview({
      persona: agent.persona,
      venue,
      bucket: mapping.bucket,
      ratingCoffee5: mapping.rating_coffee_5,
      ratingVibe5: mapping.rating_vibe_5,
      currentObsession: state?.current_obsession,
    });

    totalCostUsd += reviewText.costUsd;
    const history = await buildSyntheticComparisonHistory(
      supabase,
      agent.reviewerId,
      mapping.bucket as ReviewBucket,
      preference,
    );

    const persisted = await persistRankedReview({
      supabase,
      reviewerId: agent.reviewerId,
      synthetic: true,
      createdAt: tickAt,
      rawInput: {
        venue_id: venue.id,
        visited_on: tickAt.slice(0, 10),
        bucket: mapping.bucket,
        rank_position: 0,
        history,
        rating_coffee_5: mapping.rating_coffee_5,
        rating_vibe_5: mapping.rating_vibe_5,
        body: reviewText.body,
      },
    });

    if (persisted.status !== "ok") {
      notes.push(`${agent.persona.id}: ${persisted.code}`);
      continue;
    }

    await supabase.from("simulation_review_metadata").insert({
      review_id: persisted.reviewId,
      reviewer_id: agent.reviewerId,
      venue_id: venue.id,
      preference_score: preference,
      prompt_tokens: reviewText.promptTokens,
      completion_tokens: reviewText.completionTokens,
      model_id: reviewText.modelId,
      created_at: tickAt,
    });

    await supabase.from("agent_state").upsert(
      {
        reviewer_id: agent.reviewerId,
        last_tick_at: tickAt,
        reviews_written: 1,
        current_obsession: state?.current_obsession ?? "house filters",
        recent_venue_ids: [venue.id, ...recent.filter((id) => id !== venue.id)].slice(0, 5),
        cumulative_prompt_tokens: reviewText.promptTokens,
        cumulative_completion_tokens: reviewText.completionTokens,
        updated_at: tickAt,
      },
      { onConflict: "reviewer_id" },
    );
    reviewsGenerated++;
  }

  await supabase.from("simulation_ticks").insert({
    tick_at: tickAt,
    agents_active: agentsActive,
    reviews_generated: reviewsGenerated,
    total_cost_usd: totalCostUsd,
    notes: notes.join("; ") || null,
  });

  return { tickAt, agentsActive, reviewsGenerated, totalCostUsd, notes };
}
