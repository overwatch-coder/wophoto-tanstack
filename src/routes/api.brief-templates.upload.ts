import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/app/api/brief-templates/upload/route";

export const Route = createFileRoute("/api/brief-templates/upload")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

