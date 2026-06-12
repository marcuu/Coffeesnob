import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

import { getVenueOverallScores } from "@/lib/aggregation";
import { computeRank } from "@/lib/ranking-context";
import { regionDisplayName, regionIdFromCityName } from "@/lib/regions";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Caffiends venue score card";

// Fraunces for the venue name, matching the in-app serif. Satori can't use
// system fonts, so fetch the TTF at render time; fall back to the bundled
// default sans if the fetch fails (the card still renders).
async function loadSerif(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Fraunces:wght@400&text=${encodeURIComponent(text)}`,
      // Ask for TTF by pretending not to support woff2.
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, city, postcode")
    .eq("slug", slug)
    .maybeSingle();

  const name = venue?.name ?? "Caffiends";
  const city = venue?.city ?? "";

  let scoreText = "—";
  let rankLine = "Not yet ranked";
  if (venue) {
    const regionId = regionIdFromCityName(venue.city);
    const { data: regionRows } = await supabase
      .from("venues")
      .select("id, city");
    const regionVenueIds = (regionRows ?? [])
      .filter((r) => regionIdFromCityName(r.city) === regionId)
      .map((r) => r.id);
    const scores = await getVenueOverallScores(supabase, regionVenueIds);
    const own = scores.get(venue.id);
    if (own?.displayable) {
      scoreText = own.score.toFixed(1);
      const rank = computeRank(venue.id, scores);
      rankLine =
        rank !== null
          ? `No. ${rank} in ${regionDisplayName(regionId)}`
          : regionDisplayName(regionId);
    }
  }

  const serif = await loadSerif(name);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "hsl(20, 14.3%, 4.1%)",
          color: "hsl(60, 9.1%, 97.8%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#c98a5e",
          }}
        >
          <span>{rankLine}</span>
          <span style={{ color: "hsl(24, 5.4%, 50%)" }}>CAFFIENDS</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              fontSize: name.length > 26 ? 64 : 84,
              fontFamily: serif ? "Fraunces" : undefined,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            {name}
          </div>
          {city ? (
            <div
              style={{
                fontSize: 28,
                letterSpacing: "0.08em",
                color: "hsl(24, 5.4%, 58%)",
              }}
            >
              {`${city}${venue?.postcode ? ` · ${venue.postcode}` : ""}`}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            style={{
              fontSize: 132,
              color: "#c98a5e",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {scoreText}
          </span>
          <span style={{ fontSize: 40, color: "hsl(24, 5.4%, 45%)" }}>
            /10
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 24,
              color: "hsl(24, 5.4%, 50%)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            The best coffee, reviewed harshly
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: serif
        ? [{ name: "Fraunces", data: serif, style: "normal" as const, weight: 400 as const }]
        : undefined,
    },
  );
}
