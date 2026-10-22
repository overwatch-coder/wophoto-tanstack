import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";

export default async function ClientWorkspacePage() {
  await requireRole(UserRole.CLIENT);

  return (
    <section className="mx-auto w-full max-w-4xl rounded-md border bg-card p-6 shadow-sm sm:p-8">
      <p className="max-w-2xl text-base leading-7 text-muted-foreground">
        Your project workspace is being set up.
      </p>
    </section>
  );
}
