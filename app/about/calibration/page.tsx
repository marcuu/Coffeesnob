import Link from "next/link";

export const metadata = {
  title: "About Calibration Reviewers — Caffiends",
  description:
    "How and why Caffiends uses AI-assisted calibration reviewers in the fictional city of Bramford.",
};

export default function CalibrationPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 prose prose-sm">
      <h1>Calibration Reviewers &amp; the City of Bramford</h1>

      <p>
        Caffiends&apos; leaderboards use a weighted-credibility algorithm that
        works out, over time, which reviewers have consistent, discerning
        taste. Before we opened to real users it had no data to learn from.
        That is the cold-start problem.
      </p>

      <p>
        So we built <strong>Bramford</strong>: a fictional city with a panel of
        AI-assisted calibration reviewers.
      </p>

      <h2>What is Bramford?</h2>
      <p>
        Bramford is a made-up city on the UK coast with an invented third-wave
        coffee scene. Its venues don&apos;t exist. Its reviewers are synthetic
        personas, each with its own voice, opinions and taste, posting reviews
        of Bramford&apos;s cafés on a daily schedule.
      </p>
      <p>
        You can browse Bramford, read the reviews, and watch the leaderboard
        move. It is a way to see the algorithm working before there is enough
        real-city data to do the same job.
      </p>

      <h2>How are the reviews generated?</h2>
      <p>
        Each calibration reviewer has a hand-written persona: a short
        biography, a voice, and a taste vector that sets out what they care
        about in a coffee. Once a day, a script feeds that persona and the
        venue&apos;s details to a large language model, which writes a review in
        the reviewer&apos;s voice.
      </p>
      <p>
        The scores (coffee quality and vibe) come straight from the taste
        vector and the venue&apos;s attributes, so they are deterministic. The
        model only writes the prose, within those numbers. We spot-check it for
        voice and quality.
      </p>

      <h2>Does this affect real-city leaderboards?</h2>
      <p>
        No. Calibration reviewers only post about Bramford venues. The
        real-city leaderboards (London, Bristol, Edinburgh) are entirely from
        real people. The algorithm calibrates credibility against real
        reviewers only, so the synthetic lot can&apos;t leak into it.
      </p>
      <p>
        Bramford exists to give the algorithm enough to work with until there
        are enough real reviews to do the same job.
      </p>

      <h2>Why tell us this?</h2>
      <p>
        Because hiding it would be a bit much. The whole point of Caffiends is
        a trustworthy signal about real coffee, and quietly padding that signal
        with synthetic data would defeat it. So Bramford is labelled for what
        it is and kept well apart from anything real.
      </p>

      <p className="text-sm text-muted-foreground">
        <Link href="/" className="underline">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
