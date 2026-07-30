import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Zap, GitBranch, LineChart, Lock, Radio, ArrowRight, Sparkles, Check, Copy, Terminal, Boxes } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FEATURES = [
  { icon: Lock, title: "Encrypted Providers", desc: "Base URLs and API keys encrypted with AES-256-GCM. Never revealed anywhere." },
  { icon: GitBranch, title: "Intelligent Routing", desc: "Priority + health + rate-limit aware routing with automatic fallbacks." },
  { icon: Radio, title: "Streaming First", desc: "Full SSE streaming, resilient to mid-stream provider failures." },
  { icon: LineChart, title: "Real Analytics", desc: "Token, cost, latency and failure metrics — from live traffic only." },
  { icon: ShieldCheck, title: "Hardened Security", desc: "RLS, rate limits, brute-force protection, and IP ban with strike system." },
  { icon: Zap, title: "Enterprise Reliability", desc: "Automatic failover across unlimited providers." },
];

const STEPS = [
  { n: "01", t: "Add a provider", d: "Encrypt your upstream base URL and API tokens with one click." },
  { n: "02", t: "Register models", d: "Map friendly model names to upstream IDs with per-1M token pricing." },
  { n: "03", t: "Issue a key & ship", d: "Point any OpenAI or Anthropic SDK at Silence. That's it." },
];

const COMPAT = [
  { t: "OpenAI SDK", d: "/v1/chat/completions" },
  { t: "Anthropic SDK", d: "/v1/messages" },
  { t: "Claude Code", d: "ANTHROPIC_BASE_URL" },
  { t: "cURL / any HTTP", d: "REST + SSE" },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] hero-grid" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl btn-primary text-white">
            <span className="text-base font-bold tracking-tight">S</span>
          </div>
          <span className="text-[17px] font-semibold tracking-tight">
            Silence<span className="text-[color:var(--brand)]">API</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          <a href="#features" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">Features</a>
          <a href="#how" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">How it works</a>
          <Link to="/docs" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">Docs</Link>
          <a href="#security" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/admin" className="rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--brand-strong)] hover:bg-[color:var(--brand-soft)]">Sign in</Link>
          <Link to="/admin" className="btn-primary hidden rounded-lg px-4 py-2 text-sm font-semibold sm:inline-flex">Get started</Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-16">
        <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="brand-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3 w-3" /> AI infrastructure, simplified
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> OpenAI & Anthropic compatible
              </span>
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              One AI Gateway for<br />every <span className="text-[color:var(--brand)]">AI model</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Route requests through one OpenAI-compatible endpoint. Encrypted providers, intelligent fallbacks, real analytics — engineered for production reliability.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/admin" className="btn-primary inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold">
                Open Console <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/docs" className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--hairline)] bg-white px-5 py-3 text-sm font-semibold text-foreground hover:border-[color:var(--brand)]/40">
                View docs
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No demo data", "Encrypted at rest", "Set up in under 2 minutes"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)]"><Check className="h-2.5 w-2.5" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Code preview card */}
          <div className="relative">
            <div aria-hidden className="absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-tr from-[color:var(--brand)]/25 via-transparent to-[color:var(--brand-glow)]/25 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0b1220] shadow-2xl shadow-[color:var(--brand)]/20">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <div className="ml-3 flex items-center gap-1 text-[11px] text-slate-400">
                  <span className="rounded-md bg-white/10 px-2 py-1 text-slate-100 ring-1 ring-white/10">python</span>
                  <span className="rounded-md px-2 py-1 hover:bg-white/5">cURL</span>
                  <span className="rounded-md px-2 py-1 hover:bg-white/5">node</span>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-white/5">
                  <Copy className="h-3 w-3" /> copy
                </span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-slate-200">
<span className="text-slate-500">from</span> <span className="text-sky-300">openai</span> <span className="text-slate-500">import</span> OpenAI{"\n\n"}
client = OpenAI({"\n"}
{"    "}base_url=<span className="text-emerald-300">&quot;https://silence-api.lovable.app/v1&quot;</span>,{"\n"}
{"    "}api_key=<span className="text-emerald-300">&quot;sk-silence-xxxxxxxx&quot;</span>{"\n"}
){"\n\n"}
resp = client.chat.completions.create({"\n"}
{"    "}model=<span className="text-emerald-300">&quot;auto/silence&quot;</span>,{"\n"}
{"    "}messages=[{"{"}<span className="text-amber-300">&quot;role&quot;</span>: <span className="text-emerald-300">&quot;user&quot;</span>, <span className="text-amber-300">&quot;content&quot;</span>: <span className="text-emerald-300">&quot;Hello!&quot;</span>{"}"}]{"\n"}
){"\n\n"}
<span className="text-slate-500">print</span>(resp.choices[<span className="text-purple-300">0</span>].message.content)
              </pre>
              <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-4 py-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 200 OK · 312 ms</span>
                <span className="font-mono">gemma-4-31B-it</span>
              </div>
            </div>
          </div>
        </section>

        {/* Compatibility strip */}
        <section className="mt-14 rounded-2xl border border-[color:var(--hairline)] bg-white/70 p-4 backdrop-blur sm:mt-16 sm:p-5">
          <div className="mb-3 flex items-center gap-2 px-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-[color:var(--hairline)]" />
            Drop-in compatible with
            <span className="h-px flex-1 bg-[color:var(--hairline)]" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COMPAT.map((c) => (
              <div key={c.t} className="rounded-xl border border-[color:var(--hairline)] bg-white px-4 py-3 text-center">
                <div className="text-sm font-semibold">{c.t}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Stat strip */}
        <section className="mt-14 grid grid-cols-2 gap-3 sm:mt-16 sm:grid-cols-4 sm:gap-4">
          {[
            { icon: GitBranch, k: "Unlimited", v: "Model Providers" },
            { icon: ShieldCheck, k: "AES-256", v: "Encrypted secrets" },
            { icon: Zap, k: "99.9%", v: "Uptime SLA target" },
            { icon: LineChart, k: "Real-time", v: "Logs & Analytics" },
          ].map((s) => (
            <div key={s.v} className="card-3d rounded-2xl p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)]">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-lg font-bold tracking-tight sm:text-xl">{s.k}</div>
              <div className="text-xs text-muted-foreground sm:text-sm">{s.v}</div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section id="features" className="mt-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--brand-strong)]">
                <Boxes className="h-3 w-3" /> Platform
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Route requests across top providers.</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Switch providers without changing your integration. One endpoint, unlimited upstreams.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-3d group rounded-2xl p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)] transition group-hover:bg-[color:var(--brand)] group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mt-20">
          <div className="mb-8">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--brand-strong)]">
              <Terminal className="h-3 w-3" /> How it works
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Live in three steps.</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">No SDKs to install. No new formats to learn. Just point your existing client at Silence.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card-3d relative overflow-hidden rounded-2xl p-6">
                <div className="absolute right-4 top-4 font-mono text-3xl font-bold text-[color:var(--brand-soft)]">{s.n}</div>
                <div className="text-base font-semibold">{s.t}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="security" className="relative mt-20 overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-gradient-to-br from-[color:var(--brand-soft)] to-white p-8 sm:p-12">
          <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[color:var(--brand)]/20 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to ship?</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">Bootstrap your first admin, add a provider and go live — in minutes.</p>
            </div>
            <Link to="/admin" className="btn-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold">
              Launch console <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <footer className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-[color:var(--hairline)] py-8 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Silence API. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/docs" className="hover:text-foreground">Docs</Link>
            <Link to="/admin" className="hover:text-foreground">Admin</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
