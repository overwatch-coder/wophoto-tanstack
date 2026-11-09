import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/src/server/handlers/chat-attachments";

export const Route = createFileRoute("/api/chat/attachments")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

