import { Auth, skipCSRFCheck } from "@auth/core";
import Google from "@auth/core/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "@auth/core/adapters";
import type { AuthConfig, Session } from "@auth/core/types";
import {
  getCookie,
  deleteCookie,
  getRequestHeader,
} from "@tanstack/react-start/server";

import { prisma } from "@/lib/prisma";
import { InvitationStatus, UserRole, UserStatus } from "@/generated/prisma/client";
import { assertGoogleAccountOwner } from "@/lib/google-account-owner";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const prismaAdapter = PrismaAdapter(prisma) as Adapter;

const inviteOnlyAdapter: Adapter = {
  ...prismaAdapter,
  async linkAccount(account) {
    const owner = await prisma.user.findUnique({
      where: { id: account.userId },
      select: { email: true },
    });
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
        include: { permissions: true },
      });

      if (!invitation) {
        throw new Error("An accepted invitation is required to create an account.");
      }

      const userRecord = await transaction.user.create({
        data: {
          id: user.id,
          name: user.name
            ? user.name.replace(/\s*\([^)]*\)/g, "").trim() || user.name
            : null,
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

      if (
        invitation.role === UserRole.SUPERVISOR ||
        invitation.role === UserRole.COLLABORATOR
      ) {
        await transaction.studioMember.create({
          data: {
            studioId: invitation.studioId,
            userId: userRecord.id,
            invitationId: invitation.id,
            addedById: invitation.invitedById,
            permissions:
              invitation.role === UserRole.COLLABORATOR
                ? {
                    create: invitation.permissions.map(
                      ({ area, accessLevel }) => ({ area, accessLevel })
                    ),
                  }
                : undefined,
          },
        });
      }

      return userRecord;
    });
  },
};

export const authConfig: AuthConfig = {
  adapter: inviteOnlyAdapter,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          scope: "openid profile email",
        },
      },
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  basePath: "/api/auth",
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  skipCSRFCheck,
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
      if (normalizeEmail(user.email) !== email)
        return "/login?error=AccountMismatch";

      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, status: true },
      });

      if (existingUser) {
        if (
          existingUser.role === UserRole.SUPERVISOR ||
          existingUser.role === UserRole.COLLABORATOR
        ) {
          const activeMembership = await prisma.studioMember.findFirst({
            where: { userId: existingUser.id, revokedAt: null },
            select: { id: true },
          });
          if (!activeMembership) return "/login?error=StudioAccessRevoked";
        }
        return existingUser.status === UserStatus.ACTIVE
          ? true
          : "/login?error=AccountSuspended";
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
};

export const handlers = {
  GET: (request: Request) => Auth(request, authConfig),
  POST: (request: Request) => Auth(request, authConfig),
};

export async function auth(req?: Request): Promise<Session | null> {
  let sessionToken: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(
        /(?:^|;\s*)(?:__Secure-)?authjs\.session-token=([^;]+)/
      );
      if (match) sessionToken = decodeURIComponent(match[1]);
    }
  }

  if (!sessionToken) {
    try {
      sessionToken =
        getCookie("authjs.session-token") ??
        getCookie("__Secure-authjs.session-token");
    } catch {
      // outside server context
    }
  }

  if (!sessionToken) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (
      !session ||
      session.expires < new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      },
      expires: session.expires.toISOString(),
    };
  } catch (error) {
    console.error("Failed to resolve session:", error);
    return null;
  }
}

export async function signIn(
  provider = "google",
  options?: { redirectTo?: string; redirect?: boolean }
) {
  const host =
    getRequestHeader("x-forwarded-host") ||
    getRequestHeader("host") ||
    (process.env.APP_URL ? new URL(process.env.APP_URL).host : "localhost:3000");
  const proto =
    getRequestHeader("x-forwarded-proto") ||
    (process.env.APP_URL ? new URL(process.env.APP_URL).protocol.replace(":", "") : "http");
  const origin = `${proto}://${host}`;
  const redirectTo = options?.redirectTo ?? "/";

  const req = new Request(`${origin}/api/auth/signin/${provider}`, {
    method: "POST",
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": proto,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: `callbackUrl=${encodeURIComponent(redirectTo)}`,
  });

  const res = await Auth(req, { ...authConfig, skipCSRFCheck });
  if (options?.redirect === false) {
    return res;
  }
  throw res;
}

export async function signOut(options?: {
  redirectTo?: string;
  redirect?: boolean;
}) {
  const host =
    getRequestHeader("x-forwarded-host") ||
    getRequestHeader("host") ||
    (process.env.APP_URL ? new URL(process.env.APP_URL).host : "localhost:3000");
  const proto =
    getRequestHeader("x-forwarded-proto") ||
    (process.env.APP_URL ? new URL(process.env.APP_URL).protocol.replace(":", "") : "http");
  const origin = `${proto}://${host}`;
  const redirectTo = options?.redirectTo ?? "/login";

  try {
    const token =
      getCookie("authjs.session-token") ??
      getCookie("__Secure-authjs.session-token");
    if (token) {
      await prisma.session.deleteMany({ where: { sessionToken: token } });
    }
    deleteCookie("authjs.session-token");
    deleteCookie("__Secure-authjs.session-token");
  } catch {
    // outside server context
  }

  const req = new Request(`${origin}/api/auth/signout`, {
    method: "POST",
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": proto,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: `callbackUrl=${encodeURIComponent(redirectTo)}`,
  });

  const res = await Auth(req, { ...authConfig, skipCSRFCheck });
  if (options?.redirect === false) {
    return res;
  }
  throw res;
}
