import { createFileRoute } from "@tanstack/react-router";
import { handleModelsList, modelsCors } from "@/lib/models-list.server";

export const Route = createFileRoute("/v1/models")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: modelsCors() }),
      GET: async ({ request }) => handleModelsList(request),
    },
  },
});