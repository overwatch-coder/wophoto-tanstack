import { createServerFn } from "@tanstack/react-start";
import { deleteCookie } from "@tanstack/react-start/server";
import { signOut } from "@/auth";

async function signOutUserServerImplementation() {
  try {
    deleteCookie("sidebar_state");
  } catch {
    // outside server context
  }
  await signOut({ redirectTo: "/login", redirect: false });
  return { success: true };
}


const signOutUserServerFunction = createServerFn({ method: "POST" })
  .handler(async () => signOutUserServerImplementation());
export const signOutUser = () => signOutUserServerFunction();
