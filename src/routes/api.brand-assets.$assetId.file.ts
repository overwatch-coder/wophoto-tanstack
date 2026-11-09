import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/src/server/handlers/brand-asset-file";

export const Route = createFileRoute("/api/brand-assets/$assetId/file")({
  server: {
    handlers: {
      GET: ({ request, params }) => GET(request, { params }),
    },
  },
});

