import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/src/server/handlers/chat-confirm";

export const Route = createFileRoute("/api/chat/confirm")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

