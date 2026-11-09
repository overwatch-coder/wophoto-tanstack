import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === "serverFn",
      allowRequestsWithoutOriginCheck: true,
    }),
  ],
  serverFns: {
    fetch: (input, init) => {
      return fetch(input, {
        ...init,
        cache: "no-store",
      });
    },
  },
}));

