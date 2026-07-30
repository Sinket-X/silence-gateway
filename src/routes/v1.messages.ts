// Top-level /v1/messages — what Claude Code (ANTHROPIC_BASE_URL) hits directly.
import { createFileRoute } from "@tanstack/react-router";
import { handleMessages, cors, jsonResp } from "@/lib/anthropic-bridge.server";

export const Route = createFileRoute("/v1/messages")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: cors() }),
      POST: async ({ request }) => {
        try {
          const cl = Number(request.headers.get("content-length") ?? "0");
          if (cl > 2_000_000) return jsonResp({ type: "error", error: { type: "invalid_request_error", message: "Request body too large (max 2MB)" } }, 413);
          return await handleMessages(request);
        }
        catch (e: any) { return jsonResp({ type: "error", error: { type: "api_error", message: e?.message ?? "internal" } }, 500); }
      },
    },
  },
});
