import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/app/api/chat/confirm/route";

export const Route = createFileRoute("/api/chat/confirm")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

