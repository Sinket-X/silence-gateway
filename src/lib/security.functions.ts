// Anti-bot / anti-hijack primitives for login + session binding.
// - HMAC-signed login challenge (10 min TTL, bound to IP)
// - Human interaction attestation (dwell, gestures, !webdriver)
// - Brute-force lockout via login_attempts
// - Device-fingerprint binding: only the latest signed-in device works
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { z } from "zod";

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const LOCKOUT_WINDOW_MIN = 10;
const LOCKOUT_MAX_FAILS = 5;

function getIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0].trim() ||
    getRequestIP({ xForwardedFor: true }) ||
    ""
  );
}

function hmacKey(): Buffer {
  const raw = process.env.PROVIDER_ENC_KEY;
  if (!raw) throw new Error("PROVIDER_ENC_KEY not set");
  return createHmac("sha256", "silence-challenge").update(raw).digest();
}

function signChallenge(nonce: string, exp: number, ip: string): string {
  return createHmac("sha256", hmacKey()).update(`${nonce}.${exp}.${ip}`).digest("base64url");
}

// Issue a signed challenge. Client must return it with attestation flags.
export const issueLoginChallenge = createServerFn({ method: "GET" }).handler(async () => {
  const ip = getIp();
  const nonce = randomBytes(18).toString("base64url");
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const sig = signChallenge(nonce, exp, ip);
  return { token: `${nonce}.${exp}.${sig}`, issuedAt: Date.now() };
});

const VerifyInput = z.object({
  token: z.string().max(400),
  webdriver: z.boolean(),
  interactions: z.number().min(0).max(100_000),
  dwellMs: z.number().min(0).max(3_600_000),
  ua: z.string().max(500).optional(),
});

// Validate the challenge + attestation. Bot-like traffic gets an IP strike.
export const verifyLoginChallenge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifyInput.parse(d))
  .handler(async ({ data }) => {
    const ip = getIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const strike = async (reason: string) => {
      if (ip) { try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: ip, _reason: reason }); } catch {} }
    };
    const parts = data.token.split(".");
    if (parts.length !== 3) { await strike("bad_challenge"); throw new Error("Verification failed. Reload the page."); }
    const [nonce, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) { await strike("expired_challenge"); throw new Error("Session expired. Reload the page."); }
    const expected = signChallenge(nonce, exp, ip);
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { await strike("bad_signature"); throw new Error("Verification failed."); }
    if (data.webdriver) { await strike("automation_detected"); throw new Error("Automated browser detected. Sign-in blocked."); }
    if (data.dwellMs < 1200) { await strike("too_fast"); throw new Error("Please wait a moment before signing in."); }
    if (data.interactions < 1) { await strike("no_gesture"); throw new Error("Human interaction required. Move the mouse or type, then retry."); }
    return { ok: true };
  });

// Check brute-force lockout by email BEFORE calling signInWithPassword.
export const preLoginCheck = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email().max(254) }).parse(d))
  .handler(async ({ data }) => {
    const ip = getIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MIN * 60_000).toISOString();
    const { data: rows } = await supabaseAdmin.from("login_attempts")
      .select("attempts,last_at").eq("email", data.email.toLowerCase()).gte("last_at", since);
    const total = (rows ?? []).reduce((s: number, r: any) => s + Number(r.attempts ?? 0), 0);
    if (total >= LOCKOUT_MAX_FAILS) {
      if (ip) { try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: ip, _reason: "login_lockout" }); } catch {} }
      throw new Error(`Too many failed attempts. Try again in ${LOCKOUT_WINDOW_MIN} minutes.`);
    }
    return { ok: true, remaining: Math.max(0, LOCKOUT_MAX_FAILS - total) };
  });

// Record a login result. On failure we bump login_attempts; on success we clear it.
export const recordLoginResult = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    email: z.string().trim().email().max(254),
    success: z.boolean(),
  }).parse(d))
  .handler(async ({ data }) => {
    const ip = getIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    if (data.success) {
      await supabaseAdmin.from("login_attempts").delete().eq("email", email);
      return { ok: true };
    }
    // upsert-style: try increment via RPC-less pattern
    const { data: existing } = await supabaseAdmin.from("login_attempts")
      .select("ip,attempts").eq("email", email).eq("ip", ip || "unknown").maybeSingle();
    if (existing) {
      await supabaseAdmin.from("login_attempts")
        .update({ attempts: Number(existing.attempts ?? 0) + 1, last_at: new Date().toISOString() } as any)
        .eq("email", email).eq("ip", ip || "unknown");
    } else {
      await supabaseAdmin.from("login_attempts").insert({
        email, ip: ip || "unknown", attempts: 1,
        first_at: new Date().toISOString(), last_at: new Date().toISOString(),
      } as any);
    }
    if (ip) { try { await supabaseAdmin.rpc("gw_record_ip_strike", { _ip: ip, _reason: "login_fail" }); } catch {} }
    return { ok: true };
  });

// Bind the current session to a device fingerprint. Overwrites any previous bind
// so an attacker holding stale cookies from another device is instantly kicked.
export const bindSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fingerprint: z.string().min(16).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const ip = getIp();
    const ua = getRequestHeader("user-agent") ?? "";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("session_bindings").upsert({
      user_id: context.userId,
      fingerprint: data.fingerprint,
      ua: ua.slice(0, 300),
      ip,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "user_id" });
    return { ok: true };
  });

// Called on every protected page mount. Mismatch = kick.
export const verifySessionFingerprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fingerprint: z.string().min(16).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("session_bindings")
      .select("fingerprint").eq("user_id", context.userId).maybeSingle();
    if (!row) return { ok: true, bound: false };
    return { ok: row.fingerprint === data.fingerprint, bound: true };
  });