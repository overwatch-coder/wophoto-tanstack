import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/app/api/notifications/stream/route";

export const Route = createFileRoute("/api/notifications/stream")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request as any),
    },
  },
});

