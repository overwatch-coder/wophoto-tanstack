import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.request.method !== "GET" && ctx.request.method !== "HEAD",
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

