import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/src/server/handlers/notification-stream";

export const Route = createFileRoute("/api/notifications/stream")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});

