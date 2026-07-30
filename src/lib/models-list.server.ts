// Shared /v1/models handler. Requires a valid Silence API key — no
// unauthenticated model discovery. Returns only enabled models from our
// gateway (never the upstream provider's catalog).

export async function handleModelsList(request: Request): Promise<Response> {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-api-key, anthropic-version",
  } as Record<string, string>;

  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const auth = request.headers.get("authorization") ?? request.headers.get("x-api-key") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const rawKey = (m ? m[1] : auth).trim();
  if (!rawKey) {
    if (clientIp) { try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: clientIp, _reason: "missing_key_models" }); } catch {} }
    return new Response(JSON.stringify({ error: { message: "Missing bearer token", type: "auth_error" } }), {
      status: 401, headers: { "content-type": "application/json", ...cors },
    });
  }

  if (clientIp) {
    try {
      const { data: banned } = await supabaseAdmin.rpc("gw_is_ip_banned", { _ip: clientIp });
      if (banned) {
        return new Response(JSON.stringify({ error: { message: "IP banned", type: "ip_banned" } }), {
          status: 403, headers: { "content-type": "application/json", ...cors },
        });
      }
    } catch {}
  }

  const { hashApiKey } = await import("@/lib/crypto.server");
  const keyHash = hashApiKey(rawKey);
  const { data: apiKey } = await supabaseAdmin
    .from("api_keys").select("id, enabled, user_id").eq("key_hash", keyHash).maybeSingle();
  if (!apiKey || !apiKey.enabled) {
    if (clientIp) { try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: clientIp, _reason: "invalid_key_models" }); } catch {} }
    return new Response(JSON.stringify({ error: { message: "Invalid API key", type: "auth_error" } }), {
      status: 401, headers: { "content-type": "application/json", ...cors },
    });
  }

  if (apiKey.user_id) {
    try {
      const { data: suspended } = await supabaseAdmin.rpc("is_user_suspended", { _user_id: apiKey.user_id });
      if (suspended) {
        return new Response(JSON.stringify({ error: { message: "Account suspended", type: "account_suspended" } }), {
          status: 403, headers: { "content-type": "application/json", ...cors },
        });
      }
    } catch {}
  }

  const { data: models } = await supabaseAdmin
    .from("models")
    .select("display_name, created_at, provider_id, providers!inner(enabled)")
    .eq("enabled", true);

  const list = (models ?? [])
    .filter((m: any) => m.providers?.enabled !== false)
    .map((m: any) => ({
      id: m.display_name,
      object: "model",
      created: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : 0,
      owned_by: "silence",
      type: "model",
      display_name: m.display_name,
    }));

  // OpenAI shape: { object: "list", data: [...] }
  // Anthropic shape: { data: [...], has_more: false, first_id, last_id }
  // Same payload satisfies both Claude Code and OpenAI SDK.
  return new Response(JSON.stringify({
    object: "list",
    data: list,
    has_more: false,
    first_id: list[0]?.id ?? null,
    last_id: list[list.length - 1]?.id ?? null,
  }), { status: 200, headers: { "content-type": "application/json", ...cors } });
}

export function modelsCors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-api-key, anthropic-version",
  } as Record<string, string>;
}