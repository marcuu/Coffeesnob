import Link from "next/link";

import { VenueForm } from "./venue-form";

export default function NewVenuePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/venues"
          className="text-sm text-[var(--color-muted-foreground)] hover:underline"
        >
          ← Back to venues
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Add a venue
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Any allowlisted reviewer can add a venue. You can edit or delete
          venues you created later.
        </p>
      </div>

      <VenueForm />
    </main>
  );
}
