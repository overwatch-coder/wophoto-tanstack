import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/app/api/briefs/[briefId]/file/route";

export const Route = createFileRoute("/api/briefs/$briefId/file")({
  server: {
    handlers: {
      GET: ({ request, params }) => GET(request, { params: Promise.resolve(params) }),
    },
  },
});

