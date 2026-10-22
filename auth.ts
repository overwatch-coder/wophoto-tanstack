import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";

import { prisma } from "@/lib/prisma";
import { InvitationStatus, UserStatus } from "@/generated/prisma/client";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const prismaAdapter = PrismaAdapter(prisma);

const inviteOnlyAdapter: Adapter = {
  ...prismaAdapter,
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
          name: user.name,
          email,
          emailVerified: user.emailVerified,
          image: user.image,
          role: invitation.role,
          acceptedInvitation: { connect: { id: invitation.id } },
        },
      });

      await transaction.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.USED, usedAt: now },
      });

      return userRecord;
    });
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: inviteOnlyAdapter,
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google" || profile?.email_verified !== true || !user.email) {
        return false;
      }

      const email = normalizeEmail(user.email);
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { status: true },
      });

      if (existingUser) {
        return existingUser.status === UserStatus.ACTIVE;
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

      return Boolean(acceptedInvitation);
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
