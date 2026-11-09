import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/app/api/profile/avatar/[userId]/route";

export const Route = createFileRoute("/api/profile/avatar/$userId")({
  server: {
    handlers: {
      GET: ({ request, params }) => GET(request, { params: Promise.resolve(params) }),
    },
  },
});

