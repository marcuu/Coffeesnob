type Props = {
  label: string;
};

export function SignalBadge({ label }: Props) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">
      {label}
    </span>
  );
}
