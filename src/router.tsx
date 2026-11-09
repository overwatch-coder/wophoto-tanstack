import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  });
  if (typeof window !== "undefined") {
    (window as unknown as { __TSR_ROUTER__?: typeof router }).__TSR_ROUTER__ = router;
  }
  return router;
}

export function getClientRouter() {
  if (typeof window !== "undefined") {
    return (window as unknown as { __TSR_ROUTER__?: { invalidate: () => Promise<void> } }).__TSR_ROUTER__;
  }
  return null;
}

export async function invalidateRouter() {
  if (typeof window !== "undefined") {
    const router = getClientRouter();
    if (router && typeof router.invalidate === "function") {
      await router.invalidate();
    }
  }
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
