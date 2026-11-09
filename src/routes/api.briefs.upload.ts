import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/app/api/briefs/upload/route";

export const Route = createFileRoute("/api/briefs/upload")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

