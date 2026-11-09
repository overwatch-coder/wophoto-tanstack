import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { acceptInvitation } from "@/app/actions/invitations";
import { prisma } from "@/lib/prisma";
import { InvitationStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { createHash } from "node:crypto";

const getInvitationData = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    if (token.length < 32 || token.length > 256) {
      throw notFound();
    }

    const invitation = await prisma.invitation.findFirst({
      where: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { email: true, role: true, status: true },
    });

    if (invitation?.status === InvitationStatus.ACCEPTED) {
      throw redirect({ href: "/login?invite=accepted" });
    }

    return invitation;
  });

export const Route = createFileRoute("/invite/$token")({
  loader: ({ params }) => getInvitationData({ data: params.token }),
  head: () => ({
    meta: [{ title: "Accept Invitation | WoPhoto" }],
  }),
  component: InvitePageComponent,
});

function InvitePageComponent() {
  const { token } = Route.useParams();
  const invitation = Route.useLoaderData();

  if (!invitation) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center px-6">
        <div className="w-full rounded-lg border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Invitation unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This invitation has expired, was already used, or is no longer valid. Ask your WoPhoto manager for a new invitation.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center px-6">
      <div className="w-full rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Join your WoPhoto workspace</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Accept the invitation for {invitation.email} as a {invitation.role.toLowerCase()}. You will then sign in with that Google account.
        </p>
        <form action={acceptInvitation} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full">Accept invitation</Button>
        </form>
      </div>
    </main>
  );
}

