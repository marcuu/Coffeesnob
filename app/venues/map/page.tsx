import Link from "next/link";

import { Button } from "@/components/ui/button";
import { VenuesMap } from "@/components/venues-map";
import type { Venue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function VenuesMapPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("venues")
    .select("id, slug, name, city, postcode, latitude, longitude")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Venue map</h1>
        <p className="mt-4 text-sm text-[var(--color-destructive)]">{error.message}</p>
      </main>
    );
  }

  const venues = (data ?? []) as Pick<
    Venue,
    "id" | "slug" | "name" | "city" | "postcode" | "latitude" | "longitude"
  >[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/venues"
            className="text-sm text-[var(--color-muted-foreground)] hover:underline"
          >
            ← Back to venues
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Venue map</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Browse coffee shops by location and open directions in Google Maps.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/venues/new">Add venue</Link>
        </Button>
      </div>

      <VenuesMap venues={venues} />
    </main>
  );
}
