import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/src/server/handlers/brief-template-upload";

export const Route = createFileRoute("/api/brief-templates/upload")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

