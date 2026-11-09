import type { UserRole } from "@/generated/prisma/client";
import type { DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

