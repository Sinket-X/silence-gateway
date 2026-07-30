// AES-256-GCM encryption for provider secrets. Server-only. Never import from client code.
import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.PROVIDER_ENC_KEY;
  if (!raw) throw new Error("PROVIDER_ENC_KEY not set");
  // Derive 32-byte key from arbitrary-length secret
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // v1|iv|tag|ct  (base64)
  return "v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";
  if (!payload.startsWith("v1:")) throw new Error("bad ciphertext");
  const buf = Buffer.from(payload.slice(3), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// Hash API key (sk-...) for storage. Uses SHA-256 with a static pepper from the enc key.
export function hashApiKey(rawKey: string): string {
  const pepper = getKey();
  return createHash("sha256").update(pepper).update(rawKey).digest("hex");
}

export function safeCompareHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function newApiKey(): { raw: string; prefix: string; hash: string } {
  const body = randomBytes(32).toString("base64url");
  const raw = `sk-silence-${body}`;
  return { raw, prefix: raw.slice(0, 16), hash: hashApiKey(raw) };
}