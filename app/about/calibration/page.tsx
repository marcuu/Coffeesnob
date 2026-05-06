import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CalibrationPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 32px 120px" }}>
      <Link href="/bramford" style={{ color: "var(--color-muted-foreground)", textDecoration: "none" }}>Back to Bramford</Link>
      <h1 style={{ margin: "32px 0 16px", fontFamily: "var(--font-serif)", fontSize: "clamp(32px,5vw,54px)", fontWeight: 400, lineHeight: 1.05 }}>
        Coffeesnob's calibration reviewers
      </h1>
      <div style={{ display: "grid", gap: 18, fontSize: 15, lineHeight: 1.75, color: "var(--color-muted-foreground)" }}>
        <p>
          Bramford is a fictional coastal city used to test Coffeesnob before the real community is dense enough to make every ranking useful.
        </p>
        <p>
          Its venues are fictional, and its reviewers are clearly labelled calibration reviewers. They generate AI-assisted, persona-driven reviews so leaderboards, reveal screens, and scoring machinery can be exercised in public without pretending the data came from real people visiting real cafes.
        </p>
        <p>
          Calibration reviews do not appear on real-world venue pages. Real city leaderboards are for real reviewers only.
        </p>
        <p>
          The scoring pipeline still includes Bramford reviews when scoring Bramford venues, but the simulation is not treated as proof that the credibility algorithm will behave perfectly with messy human data. It is a necessary test bed, not a substitute for real users.
        </p>
      </div>
    </main>
  );
}
