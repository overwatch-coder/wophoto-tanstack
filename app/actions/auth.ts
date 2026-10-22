"use server";

import { cookies } from "next/headers";
import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutUser() {
  const cookieStore = await cookies();
  cookieStore.delete("sidebar_state");
  await signOut({ redirectTo: "/login" });
}
