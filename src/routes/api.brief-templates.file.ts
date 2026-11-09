import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/src/server/handlers/brief-template-file";

export const Route = createFileRoute("/api/brief-templates/file")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});

