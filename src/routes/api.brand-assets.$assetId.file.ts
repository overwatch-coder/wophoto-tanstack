import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/app/api/brand-assets/[assetId]/file/route";

export const Route = createFileRoute("/api/brand-assets/$assetId/file")({
  server: {
    handlers: {
      GET: ({ request, params }) => GET(request, { params: Promise.resolve(params) }),
    },
  },
});

