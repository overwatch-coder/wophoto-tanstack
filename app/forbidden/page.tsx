export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center px-6">
      <section className="w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">You do not have access to this page</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account is signed in, but its role does not allow this action. Contact a manager if you think this is a mistake.
        </p>
      </section>
    </main>
  );
}
