// Shared bearer-key authentication for public gateway endpoints.
// Every /v1/* route MUST pass through this before doing any work — otherwise
// an unauthenticated caller gets free compute or metadata from the gateway.

export type GatewayAuthResult =
  | { ok: true; apiKey: { id: string; user_id: string | null } }
  | { ok: false; status: number; type: string; message: string };

export function clientIpOf(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    ""
  );
}

export async function authenticateGatewayKey(request: Request, reasonTag: string): Promise<GatewayAuthResult> {
  const clientIp = clientIpOf(request);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const strike = async (reason: string) => {
    if (!clientIp) return;
    try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: clientIp, _reason: reason }); } catch {}
  };

  const auth = request.headers.get("authorization") ?? request.headers.get("x-api-key") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const rawKey = (m ? m[1] : auth).trim();
  if (!rawKey) {
    await strike(`missing_key_${reasonTag}`);
    return { ok: false, status: 401, type: "auth_error", message: "Missing bearer token" };
  }

  if (clientIp) {
    try {
      const { data: banned } = await supabaseAdmin.rpc("gw_is_ip_banned", { _ip: clientIp });
      if (banned) return { ok: false, status: 403, type: "ip_banned", message: "IP temporarily blocked for abusive traffic" };
    } catch {}
  }

  const { hashApiKey } = await import("@/lib/crypto.server");
  const { data: apiKey } = await supabaseAdmin
    .from("api_keys").select("id, enabled, user_id, balance").eq("key_hash", hashApiKey(rawKey)).maybeSingle();
  if (!apiKey || !apiKey.enabled) {
    await strike(`invalid_key_${reasonTag}`);
    return { ok: false, status: 401, type: "auth_error", message: "Invalid API key" };
  }
  if (apiKey.user_id) {
    try {
      const { data: suspended } = await supabaseAdmin.rpc("is_user_suspended", { _user_id: apiKey.user_id });
      if (suspended) return { ok: false, status: 403, type: "account_suspended", message: "Account suspended. Contact admin." };
    } catch {}
  }
  return { ok: true, apiKey: { id: apiKey.id, user_id: apiKey.user_id ?? null } };
}