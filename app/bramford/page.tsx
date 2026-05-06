import Link from "next/link";

import { getVenueOverallScores } from "@/lib/aggregation";
import { buildRankMap, buildVenueRankingSummary } from "@/lib/ranking-context";
import type { Venue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function BramfordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("is_fictional", true)
    .order("name", { ascending: true });

  if (error) throw error;
  const venues = (data ?? []) as Venue[];
  const scores = venues.length > 0 ? await getVenueOverallScores(supabase, venues.map((v) => v.id)) : new Map();
  const rankMap = buildRankMap(scores);
  const sorted = [...venues].sort((a, b) => {
    const sa = scores.get(a.id);
    const sb = scores.get(b.id);
    return (sb?.score ?? 0) - (sa?.score ?? 0);
  });

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "56px 36px 120px" }}>
      <nav style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", gap: 20 }}>
        <Link href="/" style={{ color: "var(--color-muted-foreground)", textDecoration: "none" }}>Caffeinesnobs</Link>
        <Link href="/about/calibration" style={{ color: "var(--color-foreground)", textDecoration: "underline" }}>About calibration</Link>
      </nav>

      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>
        Bramford calibration city
      </span>
      <h1 style={{ margin: "18px 0 12px", fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "clamp(34px,5vw,58px)", lineHeight: 1.02 }}>
        A fictional coffee scene with real scoring pressure.
      </h1>
      <p style={{ maxWidth: 620, color: "var(--color-muted-foreground)", lineHeight: 1.7 }}>
        Bramford is Coffeesnob's public calibration sandbox: fictional venues, synthetic reviewers, and transparent labels so the algorithm can be tested without pretending the city exists.
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 44 }}>
        {sorted.map((venue) => {
          const score = scores.get(venue.id);
          const summary = buildVenueRankingSummary(venue.id, score, rankMap.get(venue.id) ?? null, "Bramford");
          return (
            <Link
              key={venue.id}
              href={`/venues/${venue.slug}`}
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, padding: "22px 0", borderBottom: "1px solid var(--color-border)", color: "inherit", textDecoration: "none" }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{venue.name}</div>
                <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>
                  {venue.address_line1} · {summary.rawReviewCount} reviews
                </div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                <div style={{ fontSize: 24 }}>{summary.formattedScore}</div>
                <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted-foreground)" }}>
                  #{rankMap.get(venue.id) ?? "-"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
