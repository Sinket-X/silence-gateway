// Shared gateway core: auth, model resolution, token rotation, upstream call.
// Used by both OpenAI /v1/chat/completions and Anthropic /v1/messages routes.

export type GatewayResult =
  | { kind: "error"; status: number; body: any }
  | { kind: "upstream_error"; status: number; body: string; contentType: string }
  | { kind: "stream"; body: ReadableStream<Uint8Array>; tokenId: string; startedAt: number; ctx: FinalizeCtx }
  | { kind: "json"; text: string; usage: { prompt_tokens: number; completion_tokens: number }; tokenId: string; startedAt: number };

export interface FinalizeCtx {
  sb: any;
  apiKey: any;
  provider: any;
  model: any;
  token: any;
  attemptStart: number;
}

// In-memory cache for decrypted provider secrets. Providers rarely change;
// decrypting AES-GCM on every request adds real latency at scale. Key on
// provider.id + updated_at so admin edits invalidate automatically.
const providerSecretCache = new Map<
  string,
  { baseUrl: string; extraHeaders: Record<string, string> }
>();

export async function runGateway(request: Request, openaiBody: any): Promise<GatewayResult> {
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
    if (clientIp) { try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: clientIp, _reason: "missing_key" }); } catch {} }
    return { kind: "error", status: 401, body: { error: { message: "Missing bearer token", type: "auth_error" } } };
  }

  const { hashApiKey, decryptSecret } = await import("@/lib/crypto.server");

  // Run ip-ban check and api-key lookup in parallel — they don't depend
  // on each other. Cuts one round-trip off the hot path.
  const keyHash = hashApiKey(rawKey);
  const [banRes, keyRes] = await Promise.all([
    clientIp
      ? (async () => {
          try { return await supabaseAdmin.rpc("gw_is_ip_banned", { _ip: clientIp }); }
          catch { return { data: false }; }
        })()
      : Promise.resolve({ data: false }),
    supabaseAdmin.from("api_keys").select("*").eq("key_hash", keyHash).maybeSingle(),
  ]);
  if (banRes?.data) {
    const { data: row } = await supabaseAdmin
      .from("banned_ips").select("expires_at, reason").eq("ip", clientIp).maybeSingle();
    const retry = row?.expires_at
      ? Math.max(1, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000))
      : 3600;
    return {
      kind: "error",
      status: 403,
      body: {
        error: {
          type: "ip_banned",
          message: `Your IP has been temporarily blocked for abusive traffic. Try again in ${Math.ceil(retry / 60)} minute(s). Contact an administrator if this is a mistake.`,
          reason: row?.reason ?? "abuse",
          retry_after_seconds: retry,
          expires_at: row?.expires_at ?? null,
        },
      },
    };
  }
  const { data: apiKey, error: keyErr } = keyRes as any;
  if (keyErr) return { kind: "error", status: 500, body: { error: { message: "internal error", type: "gateway_error" } } };
  if (!apiKey || !apiKey.enabled) {
    if (clientIp) { try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: clientIp, _reason: "invalid_key" }); } catch {} }
    return { kind: "error", status: 401, body: { error: { message: "Invalid API key", type: "auth_error" } } };
  }
  if (Number(apiKey.balance) <= 0) return { kind: "error", status: 402, body: { error: { message: "Insufficient balance", type: "billing_error" } } };

  const modelName = String(openaiBody.model ?? "").trim();
  if (!modelName) return { kind: "error", status: 400, body: { error: { message: "model is required" } } };
  if (modelName.length > 200 || /[,()"'\\]/.test(modelName)) {
    return { kind: "error", status: 404, body: { error: { message: `Model '${modelName}' not found`, type: "invalid_request" } } };
  }
  const wantStream = !!openaiBody.stream;

  // Single query: match by display_name OR upstream_model. Cuts a second
  // round-trip on the common case where the caller passes upstream ids.
  // Also parallel with the suspended-user check.
  const [modelRes, suspendedRes] = await Promise.all([
    (async () =>
      supabaseAdmin
        .from("models").select("*")
        .or(`display_name.eq.${modelName},upstream_model.eq.${modelName}`)
        .eq("enabled", true).limit(1))(),
    apiKey.user_id
      ? (async () => {
          try { return await supabaseAdmin.rpc("is_user_suspended", { _user_id: apiKey.user_id }); }
          catch { return { data: false }; }
        })()
      : Promise.resolve({ data: false }),
  ]);
  if ((suspendedRes as any)?.data) {
    return { kind: "error", status: 403, body: { error: { message: "Account suspended. Contact admin.", type: "account_suspended" } } };
  }
  if ((modelRes as any).error) return { kind: "error", status: 500, body: { error: { message: (modelRes as any).error.message } } };
  const model = (modelRes as any).data?.[0];
  if (!model) return { kind: "error", status: 404, body: { error: { message: `Model '${modelName}' not found`, type: "invalid_request" } } };

  // Fetch provider AND its tokens in parallel — tokens query filters by
  // provider_id which we already have from the model row. Cuts one full
  // round-trip off TTFB on every request.
  const [providerRes, tokensRes] = await Promise.all([
    supabaseAdmin.from("providers").select("*").eq("id", model.provider_id).maybeSingle(),
    supabaseAdmin
      .from("provider_tokens").select("*")
      .eq("provider_id", model.provider_id).eq("enabled", true)
      .order("priority", { ascending: true })
      .order("last_used_at", { ascending: true, nullsFirst: true }),
  ]);
  const { data: provider, error: pErr } = providerRes as any;
  if (pErr || !provider) return { kind: "error", status: 500, body: { error: { message: "Provider missing" } } };
  if (!provider.enabled) return { kind: "error", status: 503, body: { error: { message: "Provider disabled" } } };

  // Cache decrypted provider secrets. Keyed by id + updated_at so any
  // admin edit through the UI invalidates automatically.
  const cacheKey = `${provider.id}:${provider.updated_at ?? ""}`;
  let cached = providerSecretCache.get(cacheKey);
  if (!cached) {
    const baseUrl = decryptSecret(provider.base_url_enc).replace(/\/$/, "");
    const extraHeaders: Record<string, string> = provider.headers_enc
      ? (() => { try { return JSON.parse(decryptSecret(provider.headers_enc)); } catch { return {}; } })()
      : {};
    cached = { baseUrl, extraHeaders };
    if (providerSecretCache.size > 64) providerSecretCache.clear();
    providerSecretCache.set(cacheKey, cached);
  }
  const { baseUrl, extraHeaders } = cached;

  const nowIso = new Date().toISOString();
  const keyless = provider.requires_auth === false;
  let usable: any[] = [];
  if (keyless) {
    // Synthetic pseudo-token — no auth header, no per-token balance tracking.
    usable = [{ id: "__keyless__", api_key_enc: null, balance: Number.MAX_SAFE_INTEGER, requests_today: 0, requests_this_month: 0 }];
  } else {
    const { data: tokens, error: tErr } = tokensRes as any;
    if (tErr) return { kind: "error", status: 500, body: { error: { message: tErr.message } } };
    usable = (tokens ?? []).filter((t: any) => {
      if (t.cooldown_until && t.cooldown_until > nowIso) return false;
      if (t.daily_limit && t.requests_today >= t.daily_limit) return false;
      if (t.monthly_limit && t.requests_this_month >= t.monthly_limit) return false;
      if (Number(t.balance) <= 0) return false;
      return true;
    });
    if (usable.length === 0) return { kind: "error", status: 429, body: { error: { message: "No available tokens (all cooling / exhausted)", type: "rate_limit" } } };

    // Proactive load balancing: compute current-minute usage per token
    // (window resets after 60s) and sort by least-loaded first, so we
    // spread requests across ALL healthy tokens instead of hammering the
    // top-priority one until its provider RPM cap kicks 429s back.
    const nowMs = Date.now();
    for (const t of usable) {
      const ws = t.rpm_window_start ? new Date(t.rpm_window_start).getTime() : 0;
      t.__effRpm = (!ws || nowMs - ws >= 60_000) ? 0 : (t.rpm_window_count || 0);
    }
    usable.sort((a: any, b: any) => {
      if (a.priority !== b.priority) return (a.priority ?? 100) - (b.priority ?? 100);
      if (a.__effRpm !== b.__effRpm) return a.__effRpm - b.__effRpm;
      const la = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      const lb = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
      return la - lb;
    });
  }

  const upstreamBody = { ...openaiBody, model: model.upstream_model };
  // OpenAI-compatible streaming does NOT emit `usage` unless the client opts in.
  // Without this, prompt/completion/reasoning tokens all come back as 0 and the
  // dashboard shows nothing for streamed (Claude Code / OpenAI SDK stream) calls.
  if (upstreamBody.stream) {
    upstreamBody.stream_options = { ...(upstreamBody.stream_options ?? {}), include_usage: true };
  }
  const attempts: any[] = [];

  const providerRpm = Number(provider.rpm_limit || 0);
  // Try to atomically reserve a per-minute slot on each token in order.
  // If all are at cap, wait for the soonest window to reset (bounded ≤2s)
  // and retry once — user never sees a 429 as long as any token can free up.
  let reservedToken: any = null;
  const tryReserve = async () => {
    if (keyless) { reservedToken = usable[0]; return true; }
    for (const t of usable) {
      const { data: ok } = await supabaseAdmin.rpc("gw_reserve_token_slot", {
        _id: t.id, _rpm_limit: providerRpm,
      });
      if (ok) { reservedToken = t; return true; }
    }
    return false;
  };
  if (!(await tryReserve())) {
    // Everyone at cap. Wait until the earliest window rolls over.
    let waitMs = 60_000;
    const nowMs = Date.now();
    for (const t of usable) {
      const ws = t.rpm_window_start ? new Date(t.rpm_window_start).getTime() : nowMs;
      waitMs = Math.min(waitMs, Math.max(50, 60_000 - (nowMs - ws) + 25));
    }
    if (waitMs <= 2000) {
      await new Promise((r) => setTimeout(r, waitMs));
      await tryReserve();
    }
  }
  if (!reservedToken) {
    return { kind: "error", status: 429, body: { error: { message: "All provider tokens at per-minute cap. Add another token or lower load.", type: "rate_limit" } } };
  }
  // Put reserved first, keep rest as fallbacks for upstream errors.
  const ordered = [reservedToken, ...usable.filter((x) => x !== reservedToken)];

  for (const t of ordered) {
    const tokenKey = t.api_key_enc ? decryptSecret(t.api_key_enc) : "";
    const url = baseUrl + "/chat/completions";
    const attemptStart = Date.now();
    let res: Response;
    try {
      const authHeaders: Record<string, string> = tokenKey ? { Authorization: `Bearer ${tokenKey}` } : {};
      res = await fetch(url, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify(upstreamBody),
      });
    } catch (e: any) {
      attempts.push({ token: t.id, error: e?.message ?? "network" });
      if (t.id !== "__keyless__") await cooldownToken(supabaseAdmin, t.id, 30, "network");
      await logError(supabaseAdmin, { provider, model, token: t, tokenKey, status: null, message: e?.message ?? "network error", response: "", latency: Date.now() - attemptStart, result: "failover" });
      await logUsage(supabaseAdmin, { apiKey, provider, model, token: t, cost: 0, inTok: 0, outTok: 0, latency: Date.now() - attemptStart, success: false });
      continue;
    }

    if (res.status === 429 || res.status === 402 || res.status === 401 || res.status === 403) {
      const detail = sanitizeUpstream(await res.text());
      attempts.push({ token: t.id, status: res.status, detail });
      let secs = res.status === 429 ? 20 : 300;
      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        if (ra) {
          const n = Number(ra);
          if (Number.isFinite(n) && n > 0 && n < 600) secs = Math.ceil(n);
        }
      }
      if (t.id !== "__keyless__") await cooldownToken(supabaseAdmin, t.id, secs, res.status === 429 ? "rate_limited" : "unhealthy");
      await logError(supabaseAdmin, { provider, model, token: t, tokenKey, status: res.status, message: describeUpstream(res.status, detail), response: detail, latency: Date.now() - attemptStart, result: "failover" });
      await logUsage(supabaseAdmin, { apiKey, provider, model, token: t, cost: 0, inTok: 0, outTok: 0, latency: Date.now() - attemptStart, success: false });
      continue;
    }
    if (res.status >= 500) {
      const detail = sanitizeUpstream(await res.text());
      attempts.push({ token: t.id, status: res.status, detail });
      if (t.id !== "__keyless__") await cooldownToken(supabaseAdmin, t.id, 15, "unhealthy");
      await logError(supabaseAdmin, { provider, model, token: t, tokenKey, status: res.status, message: describeUpstream(res.status, detail), response: detail, latency: Date.now() - attemptStart, result: "failover" });
      await logUsage(supabaseAdmin, { apiKey, provider, model, token: t, cost: 0, inTok: 0, outTok: 0, latency: Date.now() - attemptStart, success: false });
      continue;
    }
    if (res.status >= 400) {
      const raw = await res.text();
      const detail = sanitizeUpstream(raw);
      // A 404 (or an empty-bodied 4xx) from an OpenAI-compatible upstream almost
      // always means THIS token has no access to the model / is dead — not that
      // the request is bad. Cool the token down and fail over to the next one;
      // only surface the error if every token responds the same way.
      if ((res.status === 404 || !raw.trim()) && ordered.length > 1) {
        // NOTE: 404 here means "this token's account has no access to THIS
        // model" — the token is still perfectly healthy for other models,
        // so we do NOT cool it down. Just skip to the next token.
        attempts.push({ token: t.id, status: res.status, detail: detail || "empty body" });
        await logError(supabaseAdmin, { provider, model, token: t, tokenKey, status: res.status, message: describeUpstream(res.status, detail), response: detail, latency: Date.now() - attemptStart, result: "failover" });
        await logUsage(supabaseAdmin, { apiKey, provider, model, token: t, cost: 0, inTok: 0, outTok: 0, latency: Date.now() - attemptStart, success: false });
        continue;
      }
      await bumpUsage(supabaseAdmin, t, 0, 0, apiKey);
      await logError(supabaseAdmin, { provider, model, token: t, tokenKey, status: res.status, message: describeUpstream(res.status, detail), response: detail, latency: Date.now() - attemptStart, result: "returned_to_client" });
      await logUsage(supabaseAdmin, { apiKey, provider, model, token: t, cost: 0, inTok: 0, outTok: 0, latency: Date.now() - attemptStart, success: false });
      return { kind: "upstream_error", status: res.status, body: detail, contentType: res.headers.get("content-type") ?? "application/json" };
    }

    const isSSE = wantStream && (res.headers.get("content-type") ?? "").includes("text/event-stream");
    if (isSSE && res.body) {
      // Inline meter via TransformStream. On Cloudflare Workers, a background
      // IIFE spawned after the Response returns is terminated — so tee() +
      // fire-and-forget silently loses every streamed request. Piping the
      // upstream body through a Transform keeps the worker context alive
      // until the client body ends, and the flush() runs our DB writes.
      // markUsed is deferred into flush() so it does NOT block first-byte.
      const clientStream = res.body.pipeThrough(
        createMeterTransform({ supabaseAdmin, apiKey, provider, model, token: t, attemptStart }),
      );
      return { kind: "stream", body: clientStream, tokenId: t.id, startedAt: attemptStart, ctx: { sb: supabaseAdmin, apiKey, provider, model, token: t, attemptStart } };
    }

    const text = await res.text();
    let usage = { prompt_tokens: 0, completion_tokens: 0 };
    let reasoningTok = 0;
    try {
      const j = JSON.parse(text);
      const u = j?.usage ?? {};
      usage = { prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0 };
      reasoningTok = u?.completion_tokens_details?.reasoning_tokens ?? 0;
      // Some providers report reasoning separately from completion_tokens; fold it in.
      if (reasoningTok && usage.completion_tokens < reasoningTok) {
        usage.completion_tokens += reasoningTok;
      }
    } catch {}
    const inCost = (usage.prompt_tokens / 1_000_000) * Number(model.user_cost_per_1m ?? 0);
    const outCost = (usage.completion_tokens / 1_000_000) * Number(model.user_cost_per_1m ?? model.output_cost_per_1m ?? 0);
    const cost = inCost + outCost + Number(model.request_cost ?? 0);
    // Parallelize the two accounting writes — they're independent.
    await Promise.all([
      bumpUsage(supabaseAdmin, t, cost, usage.prompt_tokens + usage.completion_tokens, apiKey),
      logUsage(supabaseAdmin, { apiKey, provider, model, token: t, cost, inTok: usage.prompt_tokens, outTok: usage.completion_tokens, latency: Date.now() - attemptStart, success: true }),
      t.id !== "__keyless__" ? markUsed(supabaseAdmin, t.id) : Promise.resolve(),
    ]);
    return { kind: "json", text, usage, tokenId: t.id, startedAt: attemptStart };
  }

  return { kind: "error", status: 502, body: { error: { message: "All tokens exhausted", type: "upstream_error", attempts } } };
}

// TransformStream that forwards SSE chunks untouched to the client while
// parsing the trailing `usage` frame. On flush() (stream end) it debits
// balance and writes the usage_events row. Because the returned Response
// body pipes through this Transform, Cloudflare Workers keep the request
// context alive until flush() resolves — no lost writes.
function createMeterTransform(
  ctx: { supabaseAdmin: any; apiKey: any; provider: any; model: any; token: any; attemptStart: number },
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let buf = "";
  let inTok = 0, outTok = 0, reasoningTok = 0;
  const parseChunk = (text: string) => {
    buf += text;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const u = j?.usage;
        if (u) {
          if (typeof u.prompt_tokens === "number") inTok = u.prompt_tokens;
          if (typeof u.completion_tokens === "number") outTok = u.completion_tokens;
          const r = u?.completion_tokens_details?.reasoning_tokens;
          if (typeof r === "number") reasoningTok = r;
        }
      } catch {}
    }
  };
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      try { parseChunk(decoder.decode(chunk, { stream: true })); } catch {}
    },
    async flush() {
      try { parseChunk(decoder.decode()); } catch {}
      if (reasoningTok && outTok < reasoningTok) outTok += reasoningTok;
      const { model, apiKey, token, provider, supabaseAdmin: sb, attemptStart } = ctx;
      const inCost = (inTok / 1_000_000) * Number(model.user_cost_per_1m ?? 0);
      const outCost = (outTok / 1_000_000) * Number(model.user_cost_per_1m ?? model.output_cost_per_1m ?? 0);
      const cost = inCost + outCost + Number(model.request_cost ?? 0);
      await Promise.allSettled([
        bumpUsage(sb, token, cost, inTok + outTok, apiKey),
        logUsage(sb, {
          apiKey, provider, model, token,
          cost, inTok, outTok,
          latency: Date.now() - attemptStart, success: true,
        }),
        token.id !== "__keyless__" ? markUsed(sb, token.id) : Promise.resolve(),
      ]);
    },
  });
}

async function cooldownToken(sb: any, id: string, secs: number, health: string) {
  const until = new Date(Date.now() + secs * 1000).toISOString();
  await sb.from("provider_tokens").update({ cooldown_until: until, health, last_used_at: new Date().toISOString() }).eq("id", id);
}
async function markUsed(sb: any, id: string) {
  await sb.from("provider_tokens").update({ last_used_at: new Date().toISOString(), health: "healthy" }).eq("id", id);
}
async function bumpUsage(sb: any, token: any, cost: number, totalTokens: number, apiKey: any) {
  if (token.id !== "__keyless__") {
    // Atomic: prevents race-condition balance drain under parallel load.
    await sb.rpc("gw_debit_provider_token", { _id: token.id, _cost: cost });
  }
  if (cost > 0 || totalTokens > 0) {
    await sb.rpc("gw_debit_api_key", { _id: apiKey.id, _cost: cost, _tokens: totalTokens });
  }
}

// Strip common secret-looking patterns from upstream error bodies before
// forwarding to the caller. Prevents leaking upstream tokens, urls, keys.
function sanitizeUpstream(text: string): string {
  if (!text) return text;
  return text
    .replace(/sk-[A-Za-z0-9_\-]{16,}/g, "sk-***REDACTED***")
    .replace(/Bearer\s+[A-Za-z0-9._\-]{16,}/gi, "Bearer ***REDACTED***")
    .replace(/[A-Za-z0-9._\-]{40,}\.[A-Za-z0-9._\-]{20,}/g, "***REDACTED***") // long JWT-ish
    .slice(0, 2000);
}
// Human-readable one-liner for the admin error log.
function describeUpstream(status: number | null, detail: string): string {
  let parsed = "";
  try {
    const j = JSON.parse(detail);
    parsed = j?.error?.message ?? j?.message ?? j?.detail ?? "";
  } catch {}
  const base =
    status === 401 || status === 403 ? "Token rejected by provider (auth)" :
    status === 402 ? "Provider account out of credit" :
    status === 404 ? "Model not available for this token" :
    status === 429 ? "Provider rate limit hit" :
    status && status >= 500 ? "Provider server error" :
    status && status >= 400 ? "Provider rejected the request" :
    "Upstream failure";
  const extra = (parsed || detail || "").trim().replace(/\s+/g, " ").slice(0, 240);
  return extra ? `${base}: ${extra}` : base;
}

// Mask a provider token so admins can identify WHICH key failed
// without the key ever being readable.
function fingerprint(key: string): string {
  if (!key) return "keyless";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

async function logError(sb: any, o: {
  provider: any; model: any; token: any; tokenKey: string;
  status: number | null; message: string; response: string;
  latency: number; result: "failover" | "returned_to_client";
}) {
  try {
    await sb.from("error_events").insert({
      provider_id: o.provider?.id ?? null,
      provider_name: o.provider?.name ?? null,
      key_fingerprint: fingerprint(o.tokenKey),
      token_label: o.token?.label ?? (o.token?.id === "__keyless__" ? "keyless" : null),
      model: o.model?.display_name ?? null,
      http_status: o.status,
      message: (o.message ?? "").slice(0, 1000),
      provider_response: sanitizeUpstream(o.response ?? "").slice(0, 2000),
      final_result: o.result,
      latency_ms: o.latency,
    } as any);
  } catch {}
}

async function logUsage(sb: any, o: { apiKey: any; provider: any; model: any; token: any; cost: number; inTok: number; outTok: number; latency: number; success: boolean }) {
  try {
    await sb.from("usage_events").insert({
      api_key_id: o.apiKey.id,
      provider_id: o.provider.id,
      provider_name: o.provider.name,
      model_id: o.model.id,
      model_name: o.model.display_name,
      input_tokens: o.inTok,
      output_tokens: o.outTok,
      total_tokens: o.inTok + o.outTok,
      cost: o.cost,
      internal_cost: 0,
      latency_ms: o.latency,
      success: o.success,
    } as any);
  } catch {}
}