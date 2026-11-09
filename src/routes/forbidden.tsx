import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, ShieldAlert } from "lucide-react";
import { signOutUser } from "@/app/actions/auth";

export const Route = createFileRoute("/forbidden")({
  head: () => ({
    meta: [{ title: "Access Unavailable | WoPhoto" }],
  }),
  component: ForbiddenPage,
});

function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldAlert aria-hidden="true" className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Access unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your account does not have access to this studio area. If you think you should be able to open it, ask the studio owner to review your access. You can still return to an area you can access or sign out below.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Open an available area
          </Link>
          <form action={signOutUser}>
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Log out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
