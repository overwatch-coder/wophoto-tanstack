import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-svh bg-background" />}>
      <AuthenticatedHome />
    </Suspense>
  );
}

async function AuthenticatedHome() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "MANAGER") {
    redirect("/manager/invitations");
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center px-6">
      <section className="w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">You’re signed in to WoPhoto</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account is ready. The {session.user.role.toLowerCase()} workspace is still being set up.
        </p>
      </section>
    </main>
  );
}
