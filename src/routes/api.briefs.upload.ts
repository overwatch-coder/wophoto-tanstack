import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/src/server/handlers/brief-upload";

export const Route = createFileRoute("/api/briefs/upload")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

