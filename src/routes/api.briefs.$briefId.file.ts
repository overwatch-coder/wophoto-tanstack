import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/src/server/handlers/brief-file";

export const Route = createFileRoute("/api/briefs/$briefId/file")({
  server: {
    handlers: {
      GET: ({ request, params }) => GET(request, { params }),
    },
  },
});

