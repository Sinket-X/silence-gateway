// Claude Code pings this before big requests.
import { createFileRoute } from "@tanstack/react-router";
import { handleCountTokens, cors, jsonResp } from "@/lib/anthropic-bridge.server";

export const Route = createFileRoute("/v1/messages/count_tokens")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: cors() }),
      POST: async ({ request }) => {
        try { return await handleCountTokens(request); }
        catch (e: any) { return jsonResp({ type: "error", error: { type: "api_error", message: e?.message ?? "internal" } }, 500); }
      },
    },
  },
});
