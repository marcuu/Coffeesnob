import type { Metadata } from "next";

import { OnboardingApp } from "./onboarding-app";

export const metadata: Metadata = {
  title: "Onboarding · Coffeesnob",
  description:
    "Browse UK third-wave coffee venues, then tell Coffeesnob your taste for a personalised shortlist.",
};

export default function OnboardingPage() {
  return <OnboardingApp />;
}
