import { createServerFn } from "@tanstack/react-start";
import { deleteCookie } from "@tanstack/react-start/server";
import { signIn, signOut } from "@/auth";

async function signInWithGoogleServerImplementation() {
  // Auth.js otherwise treats a different Google identity as an account to link
  // to the current session, rather than a separate invited member signing in.
  await signOut({ redirect: false });
  await signIn("google", { redirectTo: "/" });
}

async function signOutUserServerImplementation() {
  try {
    deleteCookie("sidebar_state");
  } catch {
    // outside server context
  }
  await signOut({ redirectTo: "/login" });
}


const signInWithGoogleServerFunction = createServerFn({ method: "POST" })
  .handler(async () => signInWithGoogleServerImplementation());
export const signInWithGoogle = () => signInWithGoogleServerFunction();


const signOutUserServerFunction = createServerFn({ method: "POST" })
  .handler(async () => signOutUserServerImplementation());
export const signOutUser = () => signOutUserServerFunction();
