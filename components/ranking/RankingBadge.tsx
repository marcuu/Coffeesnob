type Props = {
  rank: number;
  scopeLabel: string;
};

export function RankingBadge({ rank, scopeLabel }: Props) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-semibold tabular-nums">
      #{rank} in {scopeLabel}
    </span>
  );
}
