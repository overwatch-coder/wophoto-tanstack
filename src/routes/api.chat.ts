import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/src/server/handlers/chat";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

