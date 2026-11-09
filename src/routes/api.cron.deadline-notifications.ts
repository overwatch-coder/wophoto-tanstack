import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/src/server/handlers/deadline-notifications";

export const Route = createFileRoute("/api/cron/deadline-notifications")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});

