"use server";

import { cookies } from "next/headers";
import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  // Auth.js otherwise treats a different Google identity as an account to link
  // to the current session, rather than a separate invited member signing in.
  await signOut({ redirect: false });
  await signIn("google", { redirectTo: "/" });
}

export async function signOutUser() {
  const cookieStore = await cookies();
  cookieStore.delete("sidebar_state");
  await signOut({ redirectTo: "/login" });
}
