import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Terminal, Sparkles, Zap, ShieldCheck, Rocket, ChevronRight, ChevronDown, KeyRound, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import anthropicLogo from "@/assets/logos/anthropic.svg.asset.json";
import linuxLogo from "@/assets/logos/linux.svg.asset.json";
import ubuntuLogo from "@/assets/logos/ubuntu.svg.asset.json";
import appleLogo from "@/assets/logos/apple.svg.asset.json";
import windowsLogo from "@/assets/logos/windows.svg.asset.json";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — Silence API · Claude Code, Kimi Code, OpenAI SDK" },
      { name: "description", content: "Silence API docs: OpenAI-compatible gateway, Anthropic /v1/messages endpoint, and step-by-step setup for Claude Code and Kimi Code on Linux, macOS and Windows." },
    ],
  }),
  component: DocsPage,
});

const BASE_URL = "https://silence-api.lovable.app/api/public";

/* Brand-accurate SVGs loaded from the Lovable CDN */
const ANTHROPIC_URL = anthropicLogo.url;
const LINUX_URL = linuxLogo.url;
const UBUNTU_URL = ubuntuLogo.url;
const APPLE_URL = appleLogo.url;
const WINDOWS_URL = windowsLogo.url;

/* Simple inline Kimi glyph — subtle, on-brand, no external asset */
function KimiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("select-none", className)} aria-hidden="true">
      <defs>
        <linearGradient id="kimi-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.60 0.20 258)" />
          <stop offset="100%" stopColor="oklch(0.52 0.22 262)" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#kimi-g)" />
      <path d="M8 6.5v11M8 12l6-5.5M8 12l6.2 5.5" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function LogoImg({ src, className, alt }: { src: string; className?: string; alt: string }) {
  return <img src={src} alt={alt} className={cn("select-none", className)} draggable={false} />;
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); } catch {}
      }}
      className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.08] px-2 py-1 text-[11px] font-medium text-slate-200/90 backdrop-blur transition hover:scale-[1.03] hover:bg-white/[0.16] hover:text-white active:scale-95"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{ok ? "Copied" : "Copy"}</span>
    </button>
  );
}

function CodeBlock({ code, lang, filename }: { code: string; lang?: string; filename?: string }) {
  return (
    <div className="group relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d1226] to-[#080b1a] shadow-[0_20px_60px_-30px_rgba(2,6,23,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] transition-shadow hover:shadow-[0_30px_80px_-30px_rgba(2,6,23,0.75),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-3 py-2 sm:px-4 sm:py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 min-w-0 flex-1 truncate text-[11px] font-medium text-slate-400">
          {filename ?? (lang === "powershell" ? "PowerShell" : lang === "bash" ? "bash" : "terminal")}
        </span>
        {lang && (
          <span className="hidden rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-slate-400 sm:inline">
            {lang}
          </span>
        )}
      </div>
      <pre className="max-w-full overflow-x-auto p-3 pt-8 text-[12px] leading-relaxed text-slate-100 sm:p-4 sm:pt-4 sm:pr-24 sm:text-[12.5px]">
        <code className="whitespace-pre">{code}</code>
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

type OS = "linux" | "mac" | "windows";

function DocsPage() {
  const [os, setOs] = useState<OS>("linux");
  const [kimiOs, setKimiOs] = useState<OS>("linux");
  const [activeSection, setActiveSection] = useState("quickstart");
  const [openStep, setOpenStep] = useState<number | null>(1);
  const [openKimiStep, setOpenKimiStep] = useState<number | null>(1);

  useEffect(() => {
    const ids = ["quickstart", "windows-noinstall", "claude-code", "kimi-code", "openai-sdk", "anthropic-sdk", "streaming", "errors"];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis?.target?.id) setActiveSection(vis.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const installCmd: Record<OS, string> = {
    linux: `# Ubuntu / Debian — install Node.js 20 LTS then Claude Code
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g @anthropic-ai/claude-code

# verify
claude --version`,
    mac: `# macOS (Homebrew)
brew install node
npm install -g @anthropic-ai/claude-code

# verify
claude --version`,
    windows: `# Windows (PowerShell, run as Administrator)
winget install OpenJS.NodeJS.LTS
npm install -g @anthropic-ai/claude-code

# verify
claude --version`,
  };

  const envCmd: Record<OS, string> = {
    linux: `# add to ~/.bashrc or ~/.zshrc
export ANTHROPIC_BASE_URL="${BASE_URL}"
export ANTHROPIC_AUTH_TOKEN="<YOUR_SILENCE_API_KEY>"
export ANTHROPIC_MODEL="<YOUR_MODEL_NAME>"
export ANTHROPIC_SMALL_FAST_MODEL="<YOUR_MODEL_NAME>"

# reload
source ~/.bashrc`,
    mac: `# add to ~/.zshrc
export ANTHROPIC_BASE_URL="${BASE_URL}"
export ANTHROPIC_AUTH_TOKEN="<YOUR_SILENCE_API_KEY>"
export ANTHROPIC_MODEL="<YOUR_MODEL_NAME>"
export ANTHROPIC_SMALL_FAST_MODEL="<YOUR_MODEL_NAME>"

# reload
source ~/.zshrc`,
    windows: `# PowerShell — persist for current user
setx ANTHROPIC_BASE_URL "${BASE_URL}"
setx ANTHROPIC_AUTH_TOKEN "<YOUR_SILENCE_API_KEY>"
setx ANTHROPIC_MODEL "<YOUR_MODEL_NAME>"
setx ANTHROPIC_SMALL_FAST_MODEL "<YOUR_MODEL_NAME>"

# open a NEW PowerShell window so the vars are loaded`,
  };

  const runCmd = `claude
# → then just chat. Claude Code will route through Silence API.`;

  type TocItem = { id: string; label: string; icon?: typeof Rocket | null; logo?: string };
  const toc: TocItem[] = [
    { id: "quickstart", label: "Quickstart", icon: Rocket },
    { id: "windows-noinstall", label: "Windows (no install)", icon: Terminal },
    { id: "claude-code", label: "Claude Code", logo: ANTHROPIC_URL },
    { id: "kimi-code", label: "Kimi Code", icon: Terminal },
    { id: "openai-sdk", label: "OpenAI SDK", icon: Terminal },
    { id: "anthropic-sdk", label: "Anthropic SDK", logo: ANTHROPIC_URL },
    { id: "streaming", label: "Streaming", icon: Zap },
    { id: "errors", label: "Errors", icon: ShieldCheck },
  ];

  // Kimi Code — install commands per OS
  const kimiInstall: Record<OS, string> = {
    linux: `# Ubuntu / Debian / any Linux — single-binary installer (no Node.js needed)
curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash

# open a NEW shell so PATH picks it up, then:
kimi --version`,
    mac: `# macOS — single-binary installer (no Node.js needed)
curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash

# open a NEW terminal, then:
kimi --version`,
    windows: `# Windows (PowerShell)
irm https://code.kimi.com/kimi-code/install.ps1 | iex

# Kimi Code uses Git Bash — install Git for Windows if you don't have it:
#   https://gitforwindows.org/

# open a NEW PowerShell, then:
kimi --version`,
  };

  // Kimi Code TOML config that points at Silence
  const kimiConfig = `# ~/.kimi-code/config.toml
default_model = "silence/default"

[providers.silence]
type = "openai"
base_url = "${BASE_URL}/v1"
api_key = "<YOUR_SILENCE_API_KEY>"

[models."silence/default"]
provider = "silence"
model = "<YOUR_MODEL_NAME>"
max_context_size = 200000
capabilities = [ "tool_use" ]
display_name = "Silence"

[thinking]
enabled = false`;

  const kimiRun = `# from any project folder
cd your-project
kimi

# or run a one-shot prompt
kimi -p "Explain this repo in 3 bullet points."`;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(50%_60%_at_50%_0%,oklch(0.70_0.18_250/20%),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 hero-grid opacity-[0.35]" />

      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-[color:var(--hairline)] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg btn-primary text-white">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="truncate text-sm font-semibold tracking-tight">Silence<span className="text-[color:var(--brand)]">API</span></span>
            <span className="ml-2 hidden rounded-full border border-[color:var(--hairline)] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:inline">Docs</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <a href="#claude-code" className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              <LogoImg src={ANTHROPIC_URL} alt="Claude" className="h-3.5 w-3.5" />
              Claude Code
            </a>
            <Link to="/admin" className="rounded-lg btn-primary px-3 py-1.5 text-xs font-semibold text-white">Admin</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-5 md:px-8 md:py-14">
        {/* Hero */}
        <section className="docs-fade-up relative mb-10 overflow-hidden rounded-3xl border border-[color:var(--hairline)] bg-gradient-to-b from-white to-white/60 p-6 shadow-[var(--shadow-elegant)] sm:p-8 md:mb-14 md:p-12">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,oklch(0.70_0.18_250/25%),transparent_70%)]" />
          <span className="brand-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3" /> Developer Docs · v1
          </span>
          <h1 className="mt-4 max-w-3xl text-[28px] font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Ship faster with <span className="metallic-text">Silence API</span> — the last AI gateway you'll ever need.
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
            One endpoint. OpenAI-compatible chat completions and Anthropic-compatible messages. A drop-in setup for Claude Code, auto token rotation, live cost tracking.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <a href="#quickstart" className="inline-flex items-center gap-1.5 rounded-xl btn-primary px-4 py-2 text-sm font-semibold text-white">
              Quickstart <ChevronRight className="h-4 w-4" />
            </a>
            <a href="#claude-code" className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--hairline)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              <LogoImg src={ANTHROPIC_URL} alt="Claude" className="h-4 w-4" />
              Set up Claude Code
            </a>
          </div>

          {/* Feature strip */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: <Zap className="h-4 w-4 text-[color:var(--brand)]" />, t: "OpenAI compatible", d: "/v1/chat/completions" },
              { icon: <LogoImg src={ANTHROPIC_URL} alt="Anthropic" className="h-4 w-4" />, t: "Anthropic compatible", d: "/v1/messages" },
              { icon: <ShieldCheck className="h-4 w-4 text-[color:var(--brand)]" />, t: "Auto token rotation", d: "rate-limit safe" },
            ].map((f, i) => (
              <div
                key={f.t}
                className="docs-fade-up flex min-w-0 items-start gap-3 rounded-2xl border border-[color:var(--hairline)] bg-white/70 p-3 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--brand-soft)]">{f.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{f.t}</div>
                  <div className="truncate text-xs text-muted-foreground">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">On this page</div>
              <nav className="flex flex-col gap-0.5">
                {toc.map((t) => {
                  const active = activeSection === t.id;
                  return (
                    <a key={t.id} href={`#${t.id}`}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300",
                        active
                          ? "translate-x-0.5 bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)] ring-1 ring-[color:var(--brand)]/15"
                          : "text-muted-foreground hover:translate-x-0.5 hover:bg-slate-50 hover:text-foreground",
                      )}
                    >
                      {t.logo
                        ? <LogoImg src={t.logo} alt="" className="h-3.5 w-3.5" />
                        : t.icon
                          ? <t.icon className={cn("h-3.5 w-3.5", active && "text-[color:var(--brand)]")} />
                          : null}
                      {t.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="min-w-0 space-y-14">
            {/* Quickstart */}
            <SectionHeader id="quickstart" eyebrow="Get started" title="Quickstart" desc="Point any OpenAI or Anthropic SDK at Silence API — one env var and you're live." />
            <BaseUrlPanel />
            <CodeBlock lang="bash" filename="quickstart.sh" code={`curl ${BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer $SILENCE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "<YOUR_MODEL_NAME>",
    "messages": [{"role":"user","content":"Hello Silence"}]
  }'`} />

            {/* Windows no-install */}
            <SectionHeader
              id="windows-noinstall"
              eyebrow={<span className="inline-flex items-center gap-1.5"><LogoImg src={WINDOWS_URL} alt="Windows" className="h-3.5 w-3.5" /> Windows</span>}
              title="Chat from Windows — no install"
              desc="Every Windows 10/11 already ships PowerShell with Invoke-RestMethod and curl.exe. Paste, run, done — nothing to install."
            />

            <Accordion
              items={[
                {
                  id: "ps-pure",
                  title: "PowerShell — pure Invoke-RestMethod",
                  subtitle: "No dependencies. Ships with Windows 10/11.",
                  icon: <LogoImg src={WINDOWS_URL} alt="Windows" className="h-4 w-4" />,
                  content: (
                    <CodeBlock lang="powershell" filename="chat.ps1" code={`# 1) Set your Silence key + model for this PowerShell session
$env:SILENCE_API_KEY = "<YOUR_SILENCE_API_KEY>"
$env:MODEL           = "<YOUR_MODEL_NAME>"

# 2) Send a chat request (pure PowerShell — no extra tools)
$body = @{
  model    = $env:MODEL
  messages = @(@{ role = "user"; content = "Hello from Windows" })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "${BASE_URL}/v1/chat/completions" \`
  -Headers @{ "Authorization" = "Bearer $env:SILENCE_API_KEY"; "Content-Type" = "application/json" } \`
  -Body $body |
  Select-Object -ExpandProperty choices |
  ForEach-Object { $_.message.content }`} />
                  ),
                },
                {
                  id: "ps-curl",
                  title: "curl.exe — one-liner",
                  subtitle: "Works in PowerShell and cmd.exe alike.",
                  icon: <Terminal className="h-4 w-4 text-[color:var(--brand)]" />,
                  content: (
                    <>
                      <CodeBlock lang="powershell" filename="curl.exe (PowerShell / cmd)" code={`curl.exe -s "${BASE_URL}/v1/chat/completions" ^
  -H "Authorization: Bearer <YOUR_SILENCE_API_KEY>" ^
  -H "Content-Type: application/json" ^
  -d "{\\"model\\":\\"<YOUR_MODEL_NAME>\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Hello\\"}]}"`} />
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-[color:var(--brand)]/20 bg-[color:var(--brand-soft)]/60 p-3 text-[13px] leading-relaxed text-[color:var(--brand-strong)]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          Use <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[12px]">curl.exe</code> (the bare <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[12px]">curl</code> alias points to Invoke-WebRequest). The <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[12px]">^</code> is line-continuation.
                        </span>
                      </div>
                    </>
                  ),
                },
              ]}
            />

            {/* Claude Code */}
            <SectionHeader
              id="claude-code"
              eyebrow={<span className="inline-flex items-center gap-1.5"><LogoImg src={ANTHROPIC_URL} alt="Anthropic" className="h-3.5 w-3.5" /> Anthropic · Claude Code</span>}
              title="Set up Claude Code"
              desc="Tap a step to expand. Three steps, works on Linux, macOS and Windows."
            />

            <div className="relative space-y-4 pl-5 sm:pl-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-[color:var(--brand)]/40 before:via-[color:var(--hairline)] before:to-transparent sm:before:left-[11px]">
              <StepCard
                step={1}
                title="Install Claude Code"
                subtitle="Node.js 18+ and the Anthropic CLI"
                open={openStep === 1}
                onToggle={() => setOpenStep(openStep === 1 ? null : 1)}
              >
                <OSTabs value={os} onChange={setOs} />
                <div className="mt-4">
                  <CodeBlock code={installCmd[os]} lang={os === "windows" ? "powershell" : "bash"}
                    filename={os === "linux" ? "install.sh" : os === "mac" ? "install.sh" : "install.ps1"} />
                </div>
              </StepCard>

              <StepCard
                step={2}
                title="Point Claude Code at Silence API"
                subtitle="Set four environment variables"
                open={openStep === 2}
                onToggle={() => setOpenStep(openStep === 2 ? null : 2)}
              >
                <p className="mb-3 text-sm text-muted-foreground">
                  Replace <TokenChip>&lt;YOUR_SILENCE_API_KEY&gt;</TokenChip> and <TokenChip>&lt;YOUR_MODEL_NAME&gt;</TokenChip> with values from your admin dashboard.
                </p>
                <CodeBlock code={envCmd[os]} lang={os === "windows" ? "powershell" : "bash"}
                  filename={os === "windows" ? "env.ps1" : "~/.zshrc"} />
              </StepCard>

              <StepCard
                step={3}
                title="Launch"
                subtitle="Chat with your models through Silence"
                open={openStep === 3}
                onToggle={() => setOpenStep(openStep === 3 ? null : 3)}
              >
                <CodeBlock code={runCmd} lang="bash" filename="run.sh" />
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 text-[13px] leading-relaxed text-emerald-900">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">Every request now flows through Silence API — token rotation, cost tracking and fallbacks happen automatically.</span>
                </div>
              </StepCard>
            </div>

            {/* Kimi Code */}
            <SectionHeader
              id="kimi-code"
              eyebrow={<span className="inline-flex items-center gap-1.5"><KimiLogo className="h-3.5 w-3.5" /> Moonshot · Kimi Code CLI</span>}
              title="Set up Kimi Code"
              desc="Kimi Code CLI is a single-binary terminal agent. Point it at Silence via config.toml — no Node.js required."
            />

            <div className="relative space-y-4 pl-5 sm:pl-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-[color:var(--brand)]/40 before:via-[color:var(--hairline)] before:to-transparent sm:before:left-[11px]">
              <StepCard
                step={1}
                title="Install Kimi Code"
                subtitle="One-line installer for macOS, Linux and Windows"
                open={openKimiStep === 1}
                onToggle={() => setOpenKimiStep(openKimiStep === 1 ? null : 1)}
              >
                <OSTabs value={kimiOs} onChange={setKimiOs} />
                <div className="mt-4">
                  <CodeBlock
                    code={kimiInstall[kimiOs]}
                    lang={kimiOs === "windows" ? "powershell" : "bash"}
                    filename={kimiOs === "windows" ? "install.ps1" : "install.sh"}
                  />
                </div>
              </StepCard>

              <StepCard
                step={2}
                title="Point Kimi Code at Silence API"
                subtitle="Create ~/.kimi-code/config.toml"
                open={openKimiStep === 2}
                onToggle={() => setOpenKimiStep(openKimiStep === 2 ? null : 2)}
              >
                <p className="mb-3 text-sm text-muted-foreground">
                  Replace <TokenChip>&lt;YOUR_SILENCE_API_KEY&gt;</TokenChip> and <TokenChip>&lt;YOUR_MODEL_NAME&gt;</TokenChip> with values from your admin dashboard. Kimi Code reads credentials <em>only</em> from this file — shell env vars are ignored.
                </p>
                <CodeBlock code={kimiConfig} lang="toml" filename="~/.kimi-code/config.toml" />
              </StepCard>

              <StepCard
                step={3}
                title="Launch"
                subtitle="Interactive TUI or one-shot prompts"
                open={openKimiStep === 3}
                onToggle={() => setOpenKimiStep(openKimiStep === 3 ? null : 3)}
              >
                <CodeBlock code={kimiRun} lang="bash" filename="run.sh" />
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 text-[13px] leading-relaxed text-emerald-900">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">Tested end-to-end against Silence — Kimi Code answered <code className="rounded bg-white/70 px-1 font-mono text-[12px]">12 * 7 = 84</code> through your gateway with full token metering.</span>
                </div>
              </StepCard>
            </div>

            {/* OpenAI SDK */}
            <SectionHeader id="openai-sdk" eyebrow="SDK" title="OpenAI SDK" desc="Silence is a drop-in replacement — change baseURL and go." />
            <CodeBlock lang="ts" filename="openai.ts" code={`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE_URL}/v1",
  apiKey: process.env.SILENCE_API_KEY!,
});

const r = await client.chat.completions.create({
  model: "<YOUR_MODEL_NAME>",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(r.choices[0].message.content);`} />

            {/* Anthropic SDK */}
            <SectionHeader
              id="anthropic-sdk"
              eyebrow={<span className="inline-flex items-center gap-1.5"><LogoImg src={ANTHROPIC_URL} alt="Anthropic" className="h-3.5 w-3.5" /> Anthropic</span>}
              title="Anthropic SDK"
              desc="Full /v1/messages compatibility, including streaming SSE and content blocks."
            />
            <CodeBlock lang="ts" filename="anthropic.ts" code={`import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "${BASE_URL}",
  apiKey: process.env.SILENCE_API_KEY!,
});

const msg = await client.messages.create({
  model: "<YOUR_MODEL_NAME>",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});
console.log(msg.content);`} />

            {/* Streaming */}
            <SectionHeader id="streaming" eyebrow="Realtime" title="Streaming" desc="Server-Sent Events, proxied chunk-for-chunk with sub-100ms overhead." />
            <CodeBlock lang="bash" filename="stream.sh" code={`curl -N ${BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer $SILENCE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "<YOUR_MODEL_NAME>",
    "stream": true,
    "messages": [{"role":"user","content":"Stream me a haiku"}]
  }'`} />

            {/* Errors */}
            <SectionHeader id="errors" eyebrow="Reliability" title="Error responses" desc="Upstream details are never leaked. All failures resolve to a single friendly message." />
            <CodeBlock code={`Server is cooked Sinket soon fix it 😑`} filename="error" />

            <div className="mt-12 border-t border-[color:var(--hairline)] pt-6 text-center text-xs text-muted-foreground">
              Built with SilenceAPI · <Link to="/" className="underline decoration-dotted underline-offset-4 hover:text-foreground">Home</Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ id, eyebrow, title, desc }: { id: string; eyebrow: ReactNode; title: string; desc?: string }) {
  return (
    <div id={id} className="scroll-mt-24 sm:scroll-mt-28">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-strong)]">{eyebrow}</div>
      <h2 className="text-[22px] font-semibold tracking-tight sm:text-2xl md:text-3xl">{title}</h2>
      {desc && <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground sm:text-sm">{desc}</p>}
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-white/80 p-4 shadow-[var(--shadow-elegant)] backdrop-blur transition-transform hover:-translate-y-0.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("truncate text-sm", mono && "font-mono text-[12px] text-foreground sm:text-[12.5px]")}>{value}</div>
    </div>
  );
}

function CopyInline({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); } catch {}
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--hairline)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--brand-strong)] shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--brand-soft)] active:scale-95"
      aria-label="Copy"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{ok ? "Copied" : "Copy"}</span>
    </button>
  );
}

function BaseUrlPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Base URL — hero */}
      <div className="group relative overflow-hidden rounded-2xl border border-[color:var(--brand)]/20 bg-gradient-to-br from-white via-white to-[color:var(--brand-soft)]/60 p-4 shadow-[var(--shadow-elegant)] sm:p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,oklch(0.70_0.18_250/20%),transparent_70%)]" />
        <div className="mb-2 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)] ring-1 ring-[color:var(--brand)]/20">
            <Link2 className="h-3.5 w-3.5" />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Base URL</div>
          <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Live</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-[color:var(--hairline)] bg-white/80 px-3 py-2 font-mono text-[12px] text-foreground sm:text-[13px]">{BASE_URL}</code>
          <CopyInline text={BASE_URL} />
        </div>
        <div className="mt-2 text-[11.5px] text-muted-foreground">Append <code className="rounded bg-white/70 px-1 py-0.5 font-mono">/v1/chat/completions</code> or <code className="rounded bg-white/70 px-1 py-0.5 font-mono">/v1/messages</code>.</div>
      </div>

      {/* Auth header */}
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-white/85 p-4 shadow-[var(--shadow-elegant)] sm:p-5">
        <div className="mb-2 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)] ring-1 ring-[color:var(--brand)]/20">
            <KeyRound className="h-3.5 w-3.5" />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Auth header</div>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-[color:var(--hairline)] bg-white/80 px-3 py-2 font-mono text-[12px] text-foreground sm:text-[13px]">Authorization: Bearer sk-silence-…</code>
          <CopyInline text={`Authorization: Bearer sk-silence-...`} />
        </div>
        <div className="mt-2 text-[11.5px] text-muted-foreground">Get your key from the <Link to="/admin" className="font-medium text-[color:var(--brand-strong)] underline decoration-dotted underline-offset-4">admin dashboard</Link>.</div>
      </div>
    </div>
  );
}

function TokenChip({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-[color:var(--brand)]/20 bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[12px] font-medium text-[color:var(--brand-strong)]">{children}</code>
  );
}

function OSTabs({ value, onChange }: { value: OS; onChange: (v: OS) => void }) {
  const tabs: { id: OS; label: string; sub: string; logo: string }[] = [
    { id: "linux", label: "Linux", sub: "Ubuntu · Debian", logo: UBUNTU_URL },
    { id: "mac", label: "macOS", sub: "Homebrew", logo: APPLE_URL },
    { id: "windows", label: "Windows", sub: "PowerShell", logo: WINDOWS_URL },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "group flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-300 sm:gap-3 sm:px-3 sm:py-2.5",
            value === t.id
              ? "-translate-y-0.5 border-[color:var(--brand)] bg-[color:var(--brand-soft)] shadow-[0_10px_30px_-16px_oklch(0.55_0.22_258/40%)] ring-1 ring-[color:var(--brand)]/25"
              : "border-[color:var(--hairline)] bg-white/70 hover:-translate-y-0.5 hover:border-[color:var(--brand)]/40 hover:bg-white",
          )}
        >
          <div className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition sm:h-9 sm:w-9",
            value === t.id ? "border-[color:var(--brand)]/25 bg-white" : "border-[color:var(--hairline)] bg-white",
          )}>
            <LogoImg src={t.logo} alt={t.label} className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className={cn("truncate text-[13px] font-semibold sm:text-sm", value === t.id && "text-[color:var(--brand-strong)]")}>{t.label}</div>
            <div className="hidden truncate text-[11px] text-muted-foreground sm:block">{t.sub}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StepCard({
  step, title, subtitle, children, open, onToggle,
}: {
  step: number; title: string; subtitle?: string; children: ReactNode;
  open: boolean; onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-white/85 shadow-[var(--shadow-elegant)] backdrop-blur transition-all duration-300",
        open ? "border-[color:var(--brand)]/35 ring-1 ring-[color:var(--brand)]/10" : "border-[color:var(--hairline)] hover:border-[color:var(--brand)]/25",
      )}
    >
      <div className={cn(
        "absolute -left-5 top-4 grid h-6 w-6 place-items-center rounded-full border bg-white text-[11px] font-bold shadow-sm transition-all duration-300 sm:-left-6 sm:top-5",
        open
          ? "scale-110 border-[color:var(--brand)]/50 text-[color:var(--brand-strong)] shadow-[0_6px_20px_-8px_oklch(0.55_0.22_258/50%)]"
          : "border-[color:var(--brand)]/25 text-[color:var(--brand-strong)]",
      )}>
        {step}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-6 sm:py-5"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-tight sm:text-lg">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <div className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--hairline)] bg-white text-muted-foreground transition-all duration-500",
          open && "rotate-180 border-[color:var(--brand)]/30 bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)]",
        )}>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      <div className={cn("reveal px-4 sm:px-6", open && "is-open")}>
        <div className="reveal-inner">
          <div className="stagger pb-5 sm:pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Accordion({
  items,
}: {
  items: { id: string; title: string; subtitle?: string; icon?: ReactNode; content: ReactNode }[];
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  return (
    <div className="space-y-3">
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div
            key={it.id}
            className={cn(
              "overflow-hidden rounded-2xl border bg-white/85 shadow-[var(--shadow-elegant)] backdrop-blur transition-all duration-300",
              isOpen ? "border-[color:var(--brand)]/35 ring-1 ring-[color:var(--brand)]/10" : "border-[color:var(--hairline)] hover:border-[color:var(--brand)]/25",
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : it.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
            >
              {it.icon && (
                <div className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all duration-300",
                  isOpen ? "border-[color:var(--brand)]/30 bg-[color:var(--brand-soft)]" : "border-[color:var(--hairline)] bg-white",
                )}>
                  {it.icon}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold tracking-tight sm:text-[15px]">{it.title}</div>
                {it.subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{it.subtitle}</div>}
              </div>
              <div className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--hairline)] bg-white text-muted-foreground transition-all duration-500",
                isOpen && "rotate-180 border-[color:var(--brand)]/30 bg-[color:var(--brand-soft)] text-[color:var(--brand-strong)]",
              )}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </button>
            <div className={cn("reveal px-4 sm:px-5", isOpen && "is-open")}>
              <div className="reveal-inner">
                <div className="stagger pb-5">
                  {it.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}