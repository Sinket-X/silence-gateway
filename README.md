# Silence Gateway

An OpenAI- and Anthropic-compatible AI API gateway with a premium admin
dashboard: multi-provider routing, multi-token auto-rotation, RPM balancing,
encrypted provider secrets, API-key billing, IP banning, usage analytics and a
customer portal.

- Frontend + server: **TanStack Start (React 19, Vite)**
- Hosting: **Cloudflare Workers** (server + static assets in one Worker)
- Database + Auth: **Supabase**

> This repository is **only the source code**. There is no CI here.
> You connect this repo to Cloudflare and deploy from the Cloudflare dashboard.

---

## What you need

1. **GitHub** — this repo (already done).
2. **Supabase** — free account, one project (the database).
3. **Cloudflare** — free account (the hosting).

**Workers or Pages?** → **Workers**. This app has a live server (it proxies AI
requests, streams responses, validates API keys). Cloudflare Pages is for
static sites. The build produces a Worker that also serves every static file.

---

## Step 1 — Create the Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Name it `silence`, pick a region near you.
3. Click **Generate a password** and save it somewhere (you may need it later).
4. Click **Create new project**, wait ~2 minutes.

## Step 2 — Create the database (one copy-paste)

1. In Supabase open **SQL Editor** → **New query**.
2. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this repo,
   copy **everything**, paste it in the editor.
3. Click **Run**. It should say *Success*.

That creates every table, role, security rule (RLS) and function the app needs.

## Step 3 — Copy 3 values from Supabase

Project Settings →

| Where | What to copy | Save as |
| --- | --- | --- |
| **Data API** → Project URL | `https://xxxx.supabase.co` | `SUPABASE_URL` |
| **API Keys** → `anon` / publishable | long key | `SUPABASE_PUBLISHABLE_KEY` |
| **API Keys** → `service_role` (click reveal) | long secret key | `SUPABASE_SERVICE_ROLE_KEY` |

The `xxxx` part of the Project URL is your `SUPABASE_PROJECT_ID`.

> The `service_role` key is **secret**. It only goes into Cloudflare's
> environment variables (encrypted), never into the code or a public place.

## Step 4 — Make your encryption key

Provider base URLs and provider API keys are stored **encrypted (AES-256-GCM)**
in the database. You need one 64-character hex key.

Linux / macOS:

```bash
openssl rand -hex 32
```

Windows PowerShell:

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

Save the output as `PROVIDER_ENC_KEY`.

> ⚠️ Keep this key forever. If you change it, provider keys saved earlier can no
> longer be decrypted and must be entered again.

## Step 5 — Deploy on Cloudflare (from this repo)

1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Workers** tab → **Import a repository**.
2. Connect your GitHub account and pick this repository, branch `main`.
3. Fill the build settings **exactly** like this:

   | Field | Value |
   | --- | --- |
   | Project / Worker name | `silence-gateway` |
   | Build command | `npm install && npm run build` |
   | Deploy command | `npx wrangler deploy --config dist/server/wrangler.json` |
   | Root directory | *(leave empty)* |

4. Click **Create / Deploy**. The first build takes a few minutes.

## Step 6 — Add the environment variables

Open your Worker → **Settings** → **Variables and Secrets** → **Add**.
Add all of these (choose type **Secret** for everything except the two `VITE_`
ones, which can be plain text):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | from Step 3 |
| `SUPABASE_PUBLISHABLE_KEY` | from Step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 3 |
| `SUPABASE_PROJECT_ID` | from Step 3 |
| `PROVIDER_ENC_KEY` | from Step 4 |
| `BOOTSTRAP_ADMIN_EMAIL` | the email you want to log in with |
| `BOOTSTRAP_ADMIN_PASSWORD` | a strong password (12+ characters) |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same as `SUPABASE_PUBLISHABLE_KEY` |
| `VITE_SUPABASE_PROJECT_ID` | same as `SUPABASE_PROJECT_ID` |

Then click **Deploy / Retry deployment** once, so the build picks up the
`VITE_*` values (those are baked into the browser bundle at build time).

## Step 7 — First login

1. Open `https://silence-gateway.<your-subdomain>.workers.dev/admin`.
2. Click **Create owner account** — it uses `BOOTSTRAP_ADMIN_EMAIL` /
   `BOOTSTRAP_ADMIN_PASSWORD`. It only works while no admin exists yet.
3. Log in with those credentials.
4. **Providers** → *Add provider* → upstream base URL + RPM/RPS limits, then add
   one or more tokens with their balances.
5. **Models** → add the model names you want to expose, with prices.
6. **API keys** → create a customer key (`sk-silence-...`).

Test it:

```bash
curl https://YOUR-URL/v1/chat/completions \
  -H "Authorization: Bearer sk-silence-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"your-model","messages":[{"role":"user","content":"hi"}]}'
```

---

## Updating later

1. Change the code and push to `main` → Cloudflare rebuilds and redeploys
   automatically.
2. If the update adds a **new** `.sql` file inside `supabase/migrations/`, open
   Supabase → SQL Editor and run **only that new file** once. Files you already
   ran must not be run again.

---

## Environment variables reference

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Database / API endpoint (server side) |
| `SUPABASE_PUBLISHABLE_KEY` | Public anon key (server side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin access — secret |
| `SUPABASE_PROJECT_ID` | Project reference |
| `PROVIDER_ENC_KEY` | AES-256-GCM key for provider secrets — secret |
| `BOOTSTRAP_ADMIN_EMAIL` | Owner login email |
| `BOOTSTRAP_ADMIN_PASSWORD` | Owner login password — secret |
| `VITE_SUPABASE_URL` | Same URL, used by the browser bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same anon key, used by the browser bundle |
| `VITE_SUPABASE_PROJECT_ID` | Same project id, used by the browser bundle |

No secrets are stored in this repository. `.env` is git-ignored;
`.env.example` shows the shape only.

---

## Local development

```bash
bun install          # or: npm install
cp .env.example .env # fill in your Supabase values
bun run dev          # http://localhost:8080
```

---

## Project layout

```
src/routes/                 pages + HTTP endpoints (file-based routing)
  index.tsx                 landing page
  docs.tsx                  setup docs (Claude Code, Kimi Code, curl, PowerShell)
  admin.*.tsx               admin dashboard (providers, models, keys, users, errors, bans)
  user.*.tsx                customer portal
  api/public/v1/*           OpenAI + Anthropic compatible gateway endpoints
src/lib/
  gateway-core.server.ts    routing, token rotation, RPM balancing, metering
  anthropic-bridge.server.ts Anthropic <-> OpenAI translation
  crypto.server.ts          AES-256-GCM encryption of provider secrets
  *.functions.ts            typed server functions used by the dashboard
supabase/schema.sql         full database, one copy-paste
supabase/migrations/        the same schema split into ordered migration files
```

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Build fails on Cloudflare | Build command must be `npm install && npm run build`, deploy command `npx wrangler deploy --config dist/server/wrangler.json`. |
| Page loads but nothing works / "Missing Supabase environment variable(s)" | Add the variables from Step 6 and redeploy once. |
| Login page loads but login fails | Check `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`, then open `/admin` and create the owner account. |
| "Create owner account" says an admin already exists | An admin was already created — just log in. |
| Provider keys unreadable | `PROVIDER_ENC_KEY` was changed — restore the original value. |
