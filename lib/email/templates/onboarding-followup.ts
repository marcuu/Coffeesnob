// Plain-HTML email template (no React Email dependency). Personalisation:
// the user's top similar reviewer + one Pilgrimage venue from that
// reviewer.

export type OnboardingFollowupInput = {
  displayName: string;
  topMatchName?: string;
  topMatchSimilarityPct?: number;
  pilgrimageVenueName?: string;
  pilgrimageVenueSlug?: string;
  appBaseUrl: string;
};

export function renderOnboardingFollowup(
  input: OnboardingFollowupInput,
): { subject: string; html: string } {
  const subject = "Your Caffiends taste profile is ready";
  const personalLine =
    input.topMatchName && input.topMatchSimilarityPct
      ? `<p style="margin: 0 0 16px;">${escapeHtml(input.topMatchName)} rated <strong>${escapeHtml(input.pilgrimageVenueName ?? "a venue you haven't tried")}</strong> a Pilgrimage too. Your tastes line up about ${input.topMatchSimilarityPct}%.</p>`
      : `<p style="margin: 0 0 16px;">Your taste profile is ready.</p>`;
  const ctaHref = input.pilgrimageVenueSlug
    ? `${input.appBaseUrl}/venues/${input.pilgrimageVenueSlug}`
    : `${input.appBaseUrl}/list`;
  const ctaLabel = input.pilgrimageVenueSlug ? "See the venue" : "Open my list";

  const html = `<!doctype html>
<html lang="en">
<body style="margin: 0; padding: 0; background: #1a1716; color: #efe9e0; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; padding: 32px 24px;">
    <tr>
      <td>
        <h1 style="margin: 0 0 24px; font-family: Georgia, serif; font-size: 28px; font-weight: 400; letter-spacing: -0.02em;">
          ${escapeHtml(input.displayName)}, your taste profile is ready.
        </h1>
        ${personalLine}
        <p style="margin: 0 0 24px; line-height: 1.6;">
          Caffiends' per-axis credibility scores sharpen every time you log a review.
          One more visit and your Coffee IQ moves out of provisional.
        </p>
        <p style="margin: 0;">
          <a href="${escapeHtml(ctaHref)}" style="display: inline-block; padding: 12px 20px; background: oklch(0.75 0.11 44); color: #1a1716; text-decoration: none; border-radius: 2px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;">
            ${escapeHtml(ctaLabel)} →
          </a>
        </p>
        <p style="margin: 32px 0 0; font-size: 12px; color: #8a8480;">
          You're receiving this because you signed up for Caffiends and completed onboarding.
          One-off email; we won't follow up again.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
