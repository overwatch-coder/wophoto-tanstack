import { createFileRoute } from "@tanstack/react-router";
import { handlers } from "@/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handlers.GET(request),
      POST: ({ request }) => handlers.POST(request),
    },
  },
});
