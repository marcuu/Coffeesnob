// Admin monitoring page for the Bramford simulation.
// Fetches tick history and agent state server-side (service role not needed —
// simulation_ticks and agent_state are service-role-only via RLS, so this page
// must be protected by your admin auth gate or deployed behind a private URL).
// For now, gated by ADMIN_EMAILS env var (comma-separated).

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const MONTHLY_CAP = 20;

type TickRow = {
  id: string;
  tick_at: string;
  agents_active: number | null;
  reviews_generated: number | null;
  total_cost_usd: number | null;
  notes: string | null;
};

type AgentRow = {
  reviewer_id: string;
  reviews_written: number;
  last_tick_at: string | null;
  cumulative_prompt_tokens: number;
  cumulative_completion_tokens: number;
  // Supabase returns the joined row as an array for one-to-many syntax.
  reviewers: { display_name: string }[] | null;
};

export default async function SimulationAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
  if (!adminEmails.includes(user.email ?? "")) {
    return (
      <main className="p-8">
        <p className="text-destructive">Access denied.</p>
      </main>
    );
  }

  // Tick history (last 30).
  const { data: ticks } = await supabase
    .from("simulation_ticks")
    .select("id, tick_at, agents_active, reviews_generated, total_cost_usd, notes")
    .order("tick_at", { ascending: false })
    .limit(30);

  // Monthly spend.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: monthTicks } = await supabase
    .from("simulation_ticks")
    .select("total_cost_usd")
    .gte("tick_at", monthStart.toISOString());
  const monthlySpend = (monthTicks ?? []).reduce(
    (s: number, t: { total_cost_usd: number | null }) => s + (t.total_cost_usd ?? 0),
    0,
  );

  // Agent state overview.
  const { data: agents } = await supabase
    .from("agent_state")
    .select("reviewer_id, reviews_written, last_tick_at, cumulative_prompt_tokens, cumulative_completion_tokens, reviewers(display_name)")
    .order("reviews_written", { ascending: false });

  const totalReviews = (ticks ?? []).reduce(
    (s: number, t: TickRow) => s + (t.reviews_generated ?? 0),
    0,
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-semibold">Simulation Monitor — Bramford</h1>

      {/* Cost gauge */}
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="font-medium">Monthly spend</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${Math.min((monthlySpend / MONTHLY_CAP) * 100, 100)}%` }}
            />
          </div>
          <span className="text-sm tabular-nums">
            ${monthlySpend.toFixed(2)} / ${MONTHLY_CAP}
          </span>
        </div>
        {monthlySpend >= MONTHLY_CAP && (
          <p className="text-sm text-destructive font-medium">Cap reached — ticks paused.</p>
        )}
      </section>

      {/* Summary stats */}
      <section className="grid grid-cols-3 gap-4">
        {[
          { label: "Total reviews (log)", value: totalReviews },
          { label: "Active personas", value: (agents ?? []).length },
          { label: "Ticks recorded", value: (ticks ?? []).length },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold tabular-nums">{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Tick history */}
      <section>
        <h2 className="font-medium mb-2">Recent ticks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Reviews</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(ticks ?? []).map((t: TickRow) => (
                <tr key={t.id} className="border-b">
                  <td className="py-2 pr-4 tabular-nums">
                    {new Date(t.tick_at).toISOString().split("T")[0]}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{t.agents_active ?? "—"}</td>
                  <td className="py-2 pr-4 tabular-nums">{t.reviews_generated ?? "—"}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {t.total_cost_usd != null ? `$${Number(t.total_cost_usd).toFixed(4)}` : "—"}
                  </td>
                  <td className="py-2 text-muted-foreground truncate max-w-[200px]">
                    {t.notes ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agent state */}
      <section>
        <h2 className="font-medium mb-2">Agent review counts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="py-2 pr-4">Persona</th>
                <th className="py-2 pr-4">Reviews</th>
                <th className="py-2 pr-4">Last tick</th>
                <th className="py-2">Tokens (in/out)</th>
              </tr>
            </thead>
            <tbody>
              {(agents ?? []).map((a: AgentRow) => (
                <tr key={a.reviewer_id} className="border-b">
                  <td className="py-2 pr-4">
                    {(Array.isArray(a.reviewers) ? a.reviewers[0]?.display_name : null) ?? a.reviewer_id.slice(0, 8)}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{a.reviews_written}</td>
                  <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                    {a.last_tick_at
                      ? new Date(a.last_tick_at).toISOString().split("T")[0]
                      : "never"}
                  </td>
                  <td className="py-2 tabular-nums text-muted-foreground">
                    {a.cumulative_prompt_tokens.toLocaleString()} /{" "}
                    {a.cumulative_completion_tokens.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
