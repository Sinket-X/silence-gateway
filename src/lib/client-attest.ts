// Client-side attestation + fingerprinting. Browser-only.

export type Attestation = {
  webdriver: boolean;
  interactions: number;
  dwellMs: number;
  ua: string;
};

// Track human gestures on the page. Returns a getter for the attestation
// snapshot at submit time.
export function startAttestation(): () => Attestation {
  if (typeof window === "undefined") {
    return () => ({ webdriver: false, interactions: 0, dwellMs: 0, ua: "" });
  }
  const started = Date.now();
  let count = 0;
  const bump = () => { count += 1; };
  const opts = { passive: true } as AddEventListenerOptions;
  window.addEventListener("mousemove", bump, opts);
  window.addEventListener("keydown", bump, opts);
  window.addEventListener("touchstart", bump, opts);
  window.addEventListener("pointerdown", bump, opts);
  return () => ({
    webdriver: !!(navigator as any).webdriver,
    interactions: count,
    dwellMs: Date.now() - started,
    ua: navigator.userAgent,
  });
}

// Stable per-device fingerprint. SHA-256 of a handful of low-entropy but
// stable signals. Not for identifying humans — just for detecting "cookies
// used on a totally different device".
export async function computeFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server";
  const bits = [
    navigator.userAgent,
    navigator.language,
    (navigator.languages ?? []).join(","),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(window.devicePixelRatio),
    (navigator as any).platform ?? "",
    String((navigator as any).hardwareConcurrency ?? ""),
    String((navigator as any).deviceMemory ?? ""),
  ].join("|");
  const buf = new TextEncoder().encode(bits);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}