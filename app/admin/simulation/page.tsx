import { redirect } from "next/navigation";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function admins(): Set<string> {
  return new Set((process.env.SIMULATION_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export default async function SimulationAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !admins().has(user.email.toLowerCase())) redirect("/");

  const service = createServiceRoleClient();
  const [{ count: reviewers }, { count: venues }, { count: reviews }, { data: ticks }] = await Promise.all([
    service.from("reviewers").select("*", { count: "exact", head: true }).eq("is_synthetic", true),
    service.from("venues").select("*", { count: "exact", head: true }).eq("is_fictional", true),
    service.from("reviews").select("*", { count: "exact", head: true }).eq("is_synthetic", true),
    service.from("simulation_ticks").select("tick_at, agents_active, reviews_generated, total_cost_usd, notes").order("tick_at", { ascending: false }).limit(20),
  ]);

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "40px 32px 120px" }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 36 }}>Simulation</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "24px 0" }}>
        {[ ["Reviewers", reviewers ?? 0], ["Venues", venues ?? 0], ["Reviews", reviews ?? 0] ].map(([label, value]) => (
          <div key={label as string} style={{ border: "1px solid var(--color-border)", padding: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>{label}</div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 28 }}>{value}</div>
          </div>
        ))}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--color-muted-foreground)" }}>
            <th style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>Tick</th>
            <th style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>Active</th>
            <th style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>Reviews</th>
            <th style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>Cost</th>
            <th style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {(ticks ?? []).map((t) => (
            <tr key={t.tick_at}>
              <td style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>{t.tick_at}</td>
              <td style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>{t.agents_active}</td>
              <td style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>{t.reviews_generated}</td>
              <td style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>${Number(t.total_cost_usd ?? 0).toFixed(4)}</td>
              <td style={{ padding: "10px 0", borderBottom: "1px solid var(--color-border)" }}>{t.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
