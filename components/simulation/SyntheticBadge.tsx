"use client";

import Link from "next/link";

export function SyntheticBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
      title="This reviewer is part of Coffeesnob's bootstrap calibration panel — AI-assisted, persona-driven, generating reviews for the fictional city of Bramford."
    >
      <span aria-hidden="true">⚗</span>
      Calibration Reviewer
      <Link
        href="/about/calibration"
        className="underline underline-offset-2 hover:text-amber-900"
        onClick={(e) => e.stopPropagation()}
      >
        ?
      </Link>
    </span>
  );
}
