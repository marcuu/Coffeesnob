"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { removeFromWishlist } from "@/app/onboarding/actions";

export type WishlistItem = {
  venueId: string;
  slug: string;
  name: string;
  city: string;
  addedAt: string;
};

export function WishlistSection({
  items,
  isOwnProfile,
}: {
  items: WishlistItem[];
  isOwnProfile: boolean;
}) {
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  const visible = items.filter((i) => !removed[i.venueId]);
  if (visible.length === 0 && !isOwnProfile) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">
        Want to try
      </h2>
      {visible.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {isOwnProfile ? (
            <>
              Nothing on the wishlist yet. Tap &ldquo;Want to try&rdquo; on any{" "}
              <Link href="/venues" className="underline underline-offset-2">
                venue
              </Link>{" "}
              to save it here.
            </>
          ) : (
            "Nothing on the wishlist yet."
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li
              key={item.venueId}
              className="flex items-center justify-between rounded border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <Link
                href={`/venues/${item.slug}`}
                className="flex flex-col gap-0.5 text-[var(--color-foreground)] no-underline"
              >
                <span className="font-serif text-base">{item.name}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {item.city}
                </span>
              </Link>
              {isOwnProfile && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeFromWishlist(item.venueId);
                      if (result.status === "ok") {
                        setRemoved((p) => ({ ...p, [item.venueId]: true }));
                      }
                    })
                  }
                  className="-my-2 py-3 pl-4 text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
