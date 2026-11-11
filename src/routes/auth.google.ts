import { createFileRoute } from "@tanstack/react-router";
import { signIn, signOut } from "@/auth";

export const Route = createFileRoute("/auth/google")({
  server: {
    handlers: {
      GET: async () => {
        // Start OAuth as a document navigation so the browser receives the
        // provider redirect directly instead of following it from fetch().
        // Clear any existing session first so Auth.js doesn't try to link a
        // second Google identity to the currently signed-in account.
        await signOut({ redirect: false });
        return signIn("google", { redirectTo: "/", redirect: false });
      },
    },
  },
});
