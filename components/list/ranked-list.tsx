"use client";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useState, useTransition } from "react";

import { reorderReview } from "@/app/list/actions";
import type { ReviewBucket } from "@/lib/types";

const BUCKETS: ReviewBucket[] = ["pilgrimage", "detour", "convenience"];

const HEADINGS: Record<ReviewBucket, { label: string; copy: string }> = {
  pilgrimage: { label: "Pilgrimages", copy: "Worth crossing the city" },
  detour: { label: "Detours", copy: "Worth going out of your way" },
  convenience: { label: "Convenience", copy: "Fine if you're nearby" },
};

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

export type RankedItem = {
  id: string;
  venueId: string;
  venueSlug: string;
  venueName: string;
  rating_overall: number;
};

export function RankedList({
  initialByBucket,
}: {
  initialByBucket: Record<ReviewBucket, RankedItem[]>;
}) {
  const [byBucket, setByBucket] = useState(initialByBucket);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findBucket = (id: string): ReviewBucket | null => {
    for (const b of BUCKETS) {
      if (byBucket[b].some((i) => i.id === id)) return b;
    }
    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const fromBucket = findBucket(String(active.id));
    if (!fromBucket) return;
    const toBucket = findBucket(String(over.id)) ?? fromBucket;
    const fromIdx = byBucket[fromBucket].findIndex((i) => i.id === active.id);
    const toIdx = byBucket[toBucket].findIndex((i) => i.id === over.id);
    if (fromIdx < 0 || toIdx < 0) return;

    let next = byBucket;
    if (fromBucket === toBucket && fromIdx === toIdx) return;

    if (fromBucket === toBucket) {
      next = {
        ...byBucket,
        [fromBucket]: arrayMove(byBucket[fromBucket], fromIdx, toIdx),
      };
    } else {
      const moving = byBucket[fromBucket][fromIdx];
      const fromList = byBucket[fromBucket].filter((_, i) => i !== fromIdx);
      const toList = [
        ...byBucket[toBucket].slice(0, toIdx),
        moving,
        ...byBucket[toBucket].slice(toIdx),
      ];
      next = { ...byBucket, [fromBucket]: fromList, [toBucket]: toList };
    }
    setByBucket(next);
    setError(null);

    // Persist. Compute the rank from the new layout so the server replays
    // the placement faithfully.
    const newIndex = next[toBucket].findIndex((i) => i.id === active.id);
    const list = next[toBucket];
    const above = newIndex > 0 ? list[newIndex - 1] : null;
    const below = newIndex < list.length - 1 ? list[newIndex + 1] : null;

    let newRank = 1000;
    if (above && below) {
      newRank = Math.floor((rankFor(above, newIndex - 1) + rankFor(below, newIndex + 1)) / 2);
    } else if (above) {
      newRank = rankFor(above, newIndex - 1) + 1000;
    } else if (below) {
      newRank = Math.max(1, Math.floor(rankFor(below, newIndex + 1) / 2));
    }

    void startTransition(async () => {
      const id = String(active.id);
      const result = await reorderReview(id, toBucket, newRank);
      if (result.status === "error") {
        setError(result.message);
        // Revert.
        setByBucket(byBucket);
      } else {
        // Update the local rating_overall optimistically with the server's
        // returned value so the displayed score stays in sync.
        setByBucket((prev) => ({
          ...prev,
          [toBucket]: prev[toBucket].map((item) =>
            item.id === id
              ? { ...item, rating_overall: result.newRatingOverall }
              : item,
          ),
        }));
      }
    });

    // Helper to compute a synthetic rank for layout: items are 1000-spaced.
    function rankFor(_item: RankedItem, idx: number) {
      return (idx + 1) * 1000;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {error ? (
          <div
            style={{
              fontSize: 13,
              color: "hsl(0 84.2% 60.2%)",
              padding: "8px 16px",
              borderRadius: 2,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            {error}
          </div>
        ) : null}

        {BUCKETS.map((bucket) => {
          const items = byBucket[bucket];
          const heading = HEADINGS[bucket];
          return (
            <section key={bucket}>
              <header style={{ marginBottom: 12 }}>
                <div style={{ ...MONO, color: "oklch(0.75 0.11 44)", marginBottom: 6 }}>
                  {heading.label} · {items.length}
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "hsl(24 5.4% 60%)" }}>
                  {heading.copy}
                </div>
              </header>
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.length === 0 ? (
                    <li
                      style={{
                        ...MONO,
                        color: "hsl(24 5.4% 36%)",
                        padding: "12px 14px",
                        border: "1px dashed rgba(255,255,255,0.08)",
                        borderRadius: 2,
                      }}
                    >
                      Empty
                    </li>
                  ) : (
                    items.map((item, i) => (
                      <SortableRow key={item.id} item={item} rank={i + 1} />
                    ))
                  )}
                </ul>
              </SortableContext>
            </section>
          );
        })}
      </div>
    </DndContext>
  );
}

function SortableRow({ item, rank }: { item: RankedItem; rank: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: isDragging ? "rgba(241,168,113,0.06)" : "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 2,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "grab",
      }}
      aria-label={`${item.venueName}, rank ${rank}`}
      {...attributes}
      {...listeners}
    >
      <span style={{ ...MONO, fontSize: 9, color: "hsl(24 5.4% 50%)", minWidth: 32 }}>
        #{rank}
      </span>
      <Link
        href={`/venues/${item.venueSlug}`}
        style={{
          flex: 1,
          fontFamily: "var(--font-serif)",
          fontSize: 16,
          color: "hsl(60 9.1% 97.8%)",
          textDecoration: "none",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {item.venueName}
      </Link>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          color: "oklch(0.75 0.11 44)",
        }}
      >
        {item.rating_overall}
      </span>
    </li>
  );
}
