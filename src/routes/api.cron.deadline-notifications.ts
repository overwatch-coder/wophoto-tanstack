import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/app/api/cron/deadline-notifications/route";

export const Route = createFileRoute("/api/cron/deadline-notifications")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});

