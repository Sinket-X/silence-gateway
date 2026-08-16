import { createFileRoute } from "@tanstack/react-router";
import { cors, handleCountTokens, jsonResp } from "@/lib/anthropic-bridge.server";

export const Route = createFileRoute("/api/public/v1/messages/count_tokens")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: cors() }),
      POST: async ({ request }) => {
        try {
          const contentLength = Number(request.headers.get("content-length") ?? "0");
          if (contentLength > 2_000_000) {
            return jsonResp(
              {
                type: "error",
                error: {
                  type: "invalid_request_error",
                  message: "Request body too large (max 2MB)",
                },
              },
              413,
            );
          }
          return await handleCountTokens(request);
        } catch (error) {
          const message = error instanceof Error ? error.message : "internal";
          return jsonResp({ type: "error", error: { type: "api_error", message } }, 500);
        }
      },
    },
  },
});
