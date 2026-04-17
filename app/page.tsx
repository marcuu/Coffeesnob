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
        Signed in as {user?.email ?? "anonymous"}.
      </p>
    </main>
  );
}
