import { deleteCookie } from "@tanstack/react-start/server";
import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  // Auth.js otherwise treats a different Google identity as an account to link
  // to the current session, rather than a separate invited member signing in.
  await signOut({ redirect: false });
  await signIn("google", { redirectTo: "/" });
}

export async function signOutUser() {
  try {
    deleteCookie("sidebar_state");
  } catch {
    // outside server context
  }
  await signOut({ redirectTo: "/login" });
}
