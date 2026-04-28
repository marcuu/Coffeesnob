"use client";

import { Coffee, MapPin, MapPinned } from "lucide-react";

import type { ReviewBucket } from "@/lib/types";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

type Option = {
  bucket: ReviewBucket;
  label: string;
  copy: string;
  Icon: typeof MapPinned;
};

const OPTIONS: readonly Option[] = [
  {
    bucket: "pilgrimage",
    label: "PILGRIMAGE",
    copy: "I'd cross the city for this",
    Icon: MapPinned,
  },
  {
    bucket: "detour",
    label: "DETOUR",
    copy: "Worth going out of my way",
    Icon: Coffee,
  },
  {
    bucket: "convenience",
    label: "CONVENIENCE",
    copy: "Fine if I'm already nearby",
    Icon: MapPin,
  },
] as const;

export function BucketSelector({
  selected,
  onSelect,
}: {
  selected?: ReviewBucket;
  onSelect: (bucket: ReviewBucket) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
        maxWidth: 480,
      }}
      role="radiogroup"
      aria-label="How does this venue rank?"
    >
      {OPTIONS.map(({ bucket, label, copy, Icon }) => {
        const isSelected = selected === bucket;
        return (
          <button
            key={bucket}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(bucket)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "20px 18px",
              borderRadius: 4,
              background: isSelected
                ? "rgba(241, 168, 113, 0.08)"
                : "rgba(255,255,255,0.02)",
              border: isSelected
                ? "1px solid oklch(0.75 0.11 44)"
                : "1px solid rgba(255,255,255,0.1)",
              color: "hsl(60 9.1% 97.8%)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 160ms, border-color 160ms",
            }}
          >
            <Icon
              size={28}
              strokeWidth={1.4}
              color={isSelected ? "oklch(0.75 0.11 44)" : "hsl(24 5.4% 52%)"}
              aria-hidden
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  ...MONO,
                  color: isSelected
                    ? "oklch(0.75 0.11 44)"
                    : "hsl(60 9.1% 97.8%)",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  color: "hsl(24 5.4% 70%)",
                  fontStyle: "italic",
                }}
              >
                {copy}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
