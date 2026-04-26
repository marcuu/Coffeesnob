import Link from "next/link";

type Props = {
  rank: number;
  scopeLabel: string;
  href?: string;
};

const cls =
  "inline-flex items-center rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs font-semibold tabular-nums";

export function RankingBadge({ rank, scopeLabel, href }: Props) {
  if (href) {
    return (
      <Link href={href} className={`${cls} transition-colors hover:bg-[var(--color-muted)]`}>
        #{rank} in {scopeLabel}
      </Link>
    );
  }
  return (
    <span className={cls}>
      #{rank} in {scopeLabel}
    </span>
  );
}
