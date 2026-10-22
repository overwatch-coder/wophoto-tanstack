import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";

import { prisma } from "@/lib/prisma";
import { InvitationStatus, UserStatus } from "@/generated/prisma/client";
import { assertGoogleAccountOwner } from "@/lib/google-account-owner";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const prismaAdapter = PrismaAdapter(prisma);

const inviteOnlyAdapter: Adapter = {
  ...prismaAdapter,
  async linkAccount(account) {
    const owner = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true } });
    if (!owner) throw new Error("The WoPhoto account was not found.");
    assertGoogleAccountOwner(account, owner.email);
    await prismaAdapter.linkAccount!(account);
  },
  async createUser(user) {
    if (!user.email) {
      throw new Error("Google did not provide an email address.");
    }

    const email = normalizeEmail(user.email);
    const now = new Date();

    return prisma.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findFirst({
        where: {
          email,
          status: InvitationStatus.ACCEPTED,
          usedAt: null,
          expiresAt: { gt: now },
        },
      });

      if (!invitation) {
        throw new Error("An accepted invitation is required to create an account.");
      }

      const userRecord = await transaction.user.create({
        data: {
          id: user.id,
          name: user.name ? user.name.replace(/\s*\([^)]*\)/g, "").trim() || user.name : null,
          email,
          emailVerified: user.emailVerified,
          image: user.image,
          role: invitation.role,
          acceptedInvitation: { connect: { id: invitation.id } },
        },
      });

      await transaction.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.USED, usedAt: now, tokenEncrypted: null },
      });

      return userRecord;
    });
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: inviteOnlyAdapter,
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      if (
        account?.provider !== "google" ||
        profile?.email_verified !== true ||
        typeof profile.email !== "string" ||
        !user.email
      ) {
        return false;
      }

      const email = normalizeEmail(profile.email);
      // A previously linked Google subject must never authenticate as a different
      // WoPhoto user just because the adapter returned that user's email.
      if (normalizeEmail(user.email) !== email) return "/login?error=AccountMismatch";

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { status: true },
      });

      if (existingUser) {
        return existingUser.status === UserStatus.ACTIVE ? true : "/login?error=AccountSuspended";
      }

      const acceptedInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          status: InvitationStatus.ACCEPTED,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      return acceptedInvitation ? true : "/login?error=InvitationRequired";
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }

      return session;
    },
  },
});
