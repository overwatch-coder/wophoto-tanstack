import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/src/server/handlers/profile-avatar";

export const Route = createFileRoute("/api/profile/avatar/$userId")({
  server: {
    handlers: {
      GET: ({ request, params }) => GET(request, { params }),
    },
  },
});

