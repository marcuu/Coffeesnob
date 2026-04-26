import type { ScoreDisplayTone } from "@/lib/scoring-display";

type Props = {
  label: string;
  tone: ScoreDisplayTone;
};

const TONE_CLASSES: Record<ScoreDisplayTone, string> = {
  exceptional:
    "border border-[var(--color-border)] font-semibold text-[var(--color-foreground)]",
  outstanding:
    "border border-[var(--color-border)] font-semibold text-[var(--color-foreground)]",
  excellent:
    "border border-[var(--color-border)] font-medium text-[var(--color-foreground)]",
  strong: "bg-[var(--color-muted)] text-[var(--color-foreground)]",
  good: "bg-[var(--color-muted)] text-[var(--color-foreground)]",
  ranked:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
  unranked:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

export function ScoreBandBadge({ label, tone }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
