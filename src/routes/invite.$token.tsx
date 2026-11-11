import { createFileRoute, notFound, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useTransition, type FormEvent } from "react";
import { acceptInvitation } from "@/src/server/actions/invitations";
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

    if (invitation?.status === InvitationStatus.ACCEPTED) return { redirectTo: "/login?invite=accepted" };

    return invitation;
  });

export const Route = createFileRoute("/invite/$token")({
  loader: async ({ params }) => {
    const result = await getInvitationData({ data: params.token });
    if (result && "redirectTo" in result) throw redirect({ href: result.redirectTo });
    return result;
  },
  head: () => ({
    meta: [{ title: "Accept Invitation | WoPhoto" }],
  }),
  component: InvitePageComponent,
});

function InvitePageComponent() {
  const { token } = Route.useParams();
  const invitation = Route.useLoaderData();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAccept = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await acceptInvitation(formData);
        await router.navigate({ href: result.redirectTo });
      } catch {
        setError("We couldn't accept this invitation. Check your connection and try again.");
      }
    });
  };

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
        <form onSubmit={handleAccept} className="mt-6">
          <input type="hidden" name="token" value={token} />
          {error ? <p role="alert" className="mb-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Accepting invitation…" : "Accept invitation"}
          </Button>
        </form>
      </div>
    </main>
  );
}

