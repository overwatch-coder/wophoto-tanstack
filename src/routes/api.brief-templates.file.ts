import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/app/api/brief-templates/file/route";

export const Route = createFileRoute("/api/brief-templates/file")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});

