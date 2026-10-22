import { InvitationStatus, UserRole } from "@/generated/prisma/client";
import { Suspense } from "react";
import { InvitationForm } from "@/components/invitations/invitation-form";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export default function ManagerInvitationsPage() {
  return (
    <Suspense fallback={<main className="min-h-svh bg-background" />}>
      <ManagerInvitationsContent />
    </Suspense>
  );
}

async function ManagerInvitationsContent() {
  await requireRole(UserRole.MANAGER);

  const invitations = await prisma.invitation.findMany({
    where: { status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] } },
    select: { id: true, email: true, role: true, status: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Invite a worker or client with a one-time link. The invited person must accept the link before signing in with the same Google email.
        </p>
      </header>
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-semibold">Create an invitation</h2>
        <InvitationForm />
      </section>
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Recent invitations</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active invitations yet.</p>
        ) : (
          <ul className="divide-y">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{invitation.email}</span>
                <span className="text-muted-foreground">
                  {invitation.role.toLowerCase()} · {invitation.status.toLowerCase()} · expires {invitation.expiresAt.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
