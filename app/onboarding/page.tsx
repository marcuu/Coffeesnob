// /onboarding permanently redirects to / (308) — the feed now lives at the
// root. Files in this directory are kept intact so test imports from
// @/app/onboarding/data and @/app/onboarding/venue-mapping continue to resolve.
import { permanentRedirect } from "next/navigation";

export default function OnboardingPage() {
  permanentRedirect("/");
}
