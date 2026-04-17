import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import type { Venue } from "@/lib/types";
import { formatRating, summariseVenue } from "@/lib/venues";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("*, reviews(rating_overall)")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Venues</h1>
        <p className="mt-4 text-sm text-[var(--color-destructive)]">
          {error.message}
        </p>
      </main>
    );
  }

  const venues = (data ?? []).map((v) =>
    summariseVenue(v as Venue & { reviews: { rating_overall: number }[] | null }),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Venues</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            UK third-wave coffee spots rated by the community.
          </p>
        </div>
        <Button asChild>
          <Link href="/venues/new">Add venue</Link>
        </Button>
      </div>

      {venues.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No venues yet — add the first.
        </p>
      ) : (
        <ul className="grid gap-4">
          {venues.map((v) => (
            <li key={v.id}>
              <Link href={`/venues/${v.slug}`} className="block">
                <Card className="transition-colors hover:bg-[var(--color-muted)]">
                  <CardHeader>
                    <div className="flex items-baseline justify-between gap-4">
                      <CardTitle>{v.name}</CardTitle>
                      <div className="text-right text-sm">
                        <div className="font-medium">
                          {formatRating(v.avg_overall)}
                        </div>
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          {v.review_count} review{v.review_count === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                    <CardDescription>
                      {v.city} · {v.postcode}
                    </CardDescription>
                  </CardHeader>
                  {v.roasters.length || v.brew_methods.length ? (
                    <CardContent className="flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]">
                      {v.roasters.map((r) => (
                        <span
                          key={`r-${r}`}
                          className="rounded-full border border-[var(--color-border)] px-2 py-0.5"
                        >
                          {r}
                        </span>
                      ))}
                      {v.brew_methods.map((b) => (
                        <span
                          key={`b-${b}`}
                          className="rounded-full bg-[var(--color-muted)] px-2 py-0.5"
                        >
                          {b.replace("_", " ")}
                        </span>
                      ))}
                    </CardContent>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
