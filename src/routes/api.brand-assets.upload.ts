import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/app/api/brand-assets/upload/route";

export const Route = createFileRoute("/api/brand-assets/upload")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

