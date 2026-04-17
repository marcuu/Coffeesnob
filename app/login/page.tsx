import { loginWithGoogle } from "./actions";
import { EmailLoginForm } from "./email-form";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Coffeesnob</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Sign in to continue
        </p>
      </div>

      <form action={loginWithGoogle} className="w-full">
        <Button type="submit" className="w-full">
          Continue with Google
        </Button>
      </form>

      <div className="flex w-full items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      <EmailLoginForm />
    </main>
  );
}
