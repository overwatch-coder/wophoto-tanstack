import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/src/server/handlers/brand-asset-upload";

export const Route = createFileRoute("/api/brand-assets/upload")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

