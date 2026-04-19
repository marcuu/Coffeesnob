import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Coffeesnob</h1>
      <p className="mt-3 text-[var(--color-muted-foreground)]">
        UK third-wave coffee, reviewed by people who drink a lot of it.
      </p>
      <p className="mt-6 text-sm text-[var(--color-muted-foreground)]">
        Signed in as {user?.email ?? "anonymous"}.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/onboarding">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/venues">Browse venues</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/venues/new">Add venue</Link>
        </Button>
      </div>
      <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
        New here? Start with a personalised shortlist.
      </p>
    </main>
  );
}
