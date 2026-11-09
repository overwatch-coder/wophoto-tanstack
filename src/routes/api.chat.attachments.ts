import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/app/api/chat/attachments/route";

export const Route = createFileRoute("/api/chat/attachments")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});

