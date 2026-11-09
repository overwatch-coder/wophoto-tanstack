import { redirect } from "@tanstack/react-router";

import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/client";

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw redirect({ href: "/login" });
  }

  return session.user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw redirect({ href: "/forbidden" });
  }

  return user;
}
