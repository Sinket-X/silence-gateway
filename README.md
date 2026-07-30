# Silence Gateway

An OpenAI- and Anthropic-compatible AI API gateway with a premium admin
dashboard: multi-provider routing, multi-token auto-rotation, RPM balancing,
encrypted provider secrets, API-key billing, IP banning, usage analytics and a
user portal.

- Frontend + server: **TanStack Start (React 19, Vite)**
- Runtime: **Cloudflare Workers** (server code + static assets in one Worker)
- Database + Auth: **Supabase**

---

## What you need (only 3 accounts)

1. **GitHub** — holds this code.
2. **Supabase** — free account, one new project (the database).
3. **Cloudflare** — free account (the hosting).

> **Workers or Pages?** Use **Workers**. This app has a live server (the
> gateway proxies AI requests, streams responses, checks API keys). Cloudflare
> Pages is for static sites. The build already produces a Worker that also
> serves all static files, so Workers is the correct and best choice.

---

## Step-by-step deployment (follow in order, nothing to skip)

### Step 1 — Create your Supabase project

1. Go to <https://supabase.com> → **Sign in** → **New project**.
2. Name: `silence` (anything is fine). Choose a region near you.
3. **Database Password** → click *Generate*, and **copy it into a notepad**.
   You need it in Step 2.
4. Click **Create new project** and wait ~2 minutes until it is ready.

### Step 2 — Copy 4 values from Supabase

In your Supabase project:

| Where to click | What to copy | Save it as |
| --- | --- | --- |
| Project Settings → **Data API** → Project URL | `https://xxxx.supabase.co` | `SUPABASE_URL` |
| Project Settings → **API Keys** → `anon` / publishable key | long key | `SUPABASE_PUBLISHABLE_KEY` |
| Project Settings → **API Keys** → `service_role` key (click reveal) | long secret key | `SUPABASE_SERVICE_ROLE_KEY` |
| Project Settings → **Database** → Connection string → **URI** | `postgresql://postgres...` | `SUPABASE_DB_URL` |

Notes:

- In `SUPABASE_DB_URL`, replace `[YOUR-PASSWORD]` with the database password
  from Step 1. Use the **Session pooler / direct** URI — any of them work.
- The part `xxxx` inside your Project URL is your `SUPABASE_PROJECT_ID`.
- **Never** put the `service_role` key in a public place. It only goes into
  GitHub Secrets, which are encrypted.

### Step 3 — Create your Cloudflare API token

1. Go to <https://dash.cloudflare.com> → **My Profile** → **API Tokens** →
   **Create Token**.
2. Use template **“Edit Cloudflare Workers”** → **Continue** → **Create Token**.
3. Copy the token → save as `CLOUDFLARE_API_TOKEN`.
4. On the Cloudflare dashboard home page (Workers & Pages), copy your
   **Account ID** → save as `CLOUDFLARE_ACCOUNT_ID`.

### Step 4 — Make your encryption key

Provider base URLs and provider API keys are stored **encrypted** (AES-256-GCM)
in the database. You need one 64-character hex key.

Run this in any terminal (Linux/macOS):

```bash
openssl rand -hex 32
```

On Windows PowerShell:

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

Copy the output → save as `PROVIDER_ENC_KEY`.

> ⚠️ Keep this key forever. If you lose or change it, previously saved provider
> keys can no longer be decrypted and must be re-entered.

### Step 5 — Add the secrets to GitHub

In this repository: **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add each of these (name must match exactly):

| Secret name | Value |
| --- | --- |
| `SUPABASE_URL` | from Step 2 |
| `SUPABASE_PUBLISHABLE_KEY` | from Step 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 2 |
| `SUPABASE_PROJECT_ID` | from Step 2 |
| `SUPABASE_DB_URL` | from Step 2 (with the real password inside) |
| `PROVIDER_ENC_KEY` | from Step 4 |
| `CLOUDFLARE_API_TOKEN` | from Step 3 |
| `CLOUDFLARE_ACCOUNT_ID` | from Step 3 |
| `BOOTSTRAP_ADMIN_EMAIL` | the email you want to log in with |
| `BOOTSTRAP_ADMIN_PASSWORD` | a strong password (12+ characters) |

Optional: **Variables** tab → `WORKER_NAME` if you want a Worker name other
than `silence-gateway`.

### Step 6 — Deploy

Go to the **Actions** tab → **Deploy Silence Gateway** → **Run workflow**.
(It also runs automatically on every push to `main`.)

The workflow does everything for you:

1. Installs dependencies.
2. **Creates the whole database automatically** — all tables, roles, security
   rules and functions from `supabase/migrations/`.
3. **Creates your owner account** from `BOOTSTRAP_ADMIN_EMAIL` /
   `BOOTSTRAP_ADMIN_PASSWORD` (only if no admin exists yet).
4. Builds the app.
5. Deploys the Cloudflare Worker.
6. Uploads the runtime secrets to the Worker.

When it turns green, open:

```
https://silence-gateway.<your-cloudflare-subdomain>.workers.dev
```

The exact URL is printed in the **Deploy Worker** step log.

### Step 7 — First login

1. Open `/admin` on your new URL.
2. Log in with `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD`.
3. **Providers** → *Add provider* → put the upstream base URL, then add one or
   more tokens (keys) with their balances.
4. **Models** → add the model names you want to expose, with prices.
5. **API keys** → create a customer key (`sk-silence-...`).

Test it:

```bash
curl https://YOUR-URL/v1/chat/completions \
  -H "Authorization: Bearer sk-silence-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"your-model","messages":[{"role":"user","content":"hi"}]}'
```

---

## Future updates (code + database stay in sync)

1. Change the code, add any new `.sql` file inside `supabase/migrations/`
   (name it with a newer timestamp prefix, e.g. `20260801120000_add_x.sql`).
2. Push to `main`.
3. The workflow runs again and:
   - applies **only the new** migrations (a `_silence_migrations` ledger table
     remembers what already ran — old ones are never re-applied),
   - rebuilds and redeploys the Worker,
   - re-applies the secrets.

So a redeploy always upgrades the database to match the new code. Nothing
manual, no data loss.

---

## Environment variables reference

| Name | Where it lives | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | GitHub secret → Worker secret | Database/API endpoint |
| `SUPABASE_PUBLISHABLE_KEY` | GitHub secret → Worker secret + build | Public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub secret → Worker secret | Server-only admin access |
| `SUPABASE_PROJECT_ID` | GitHub secret → Worker secret | Project reference |
| `SUPABASE_DB_URL` | GitHub secret only | Used by the migration runner |
| `PROVIDER_ENC_KEY` | GitHub secret → Worker secret | AES-256-GCM key for provider secrets |
| `BOOTSTRAP_ADMIN_EMAIL` | GitHub secret → Worker secret | Owner login email |
| `BOOTSTRAP_ADMIN_PASSWORD` | GitHub secret → Worker secret | Owner login password |
| `CLOUDFLARE_API_TOKEN` | GitHub secret only | Lets the workflow deploy |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub secret only | Your Cloudflare account |

Secrets are never written into the repository. `.env` is git-ignored;
`.env.example` shows the shape only.

---

## Local development

```bash
bun install
cp .env.example .env   # fill in your Supabase values
bun run dev            # http://localhost:8080
```

Apply migrations locally:

```bash
SUPABASE_DB_URL="postgresql://..." ./scripts/apply-migrations.sh
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
supabase/migrations/        the entire database schema, in order
scripts/                    migration runner + owner bootstrap
.github/workflows/deploy.yml one-click deploy pipeline
```

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Workflow fails at *Apply database migrations* | `SUPABASE_DB_URL` is wrong or still contains `[YOUR-PASSWORD]`. |
| Workflow fails at *Deploy Worker* | Cloudflare token lacks Workers edit permission, or the account ID is wrong. |
| Site loads but login fails | Check `BOOTSTRAP_ADMIN_*` secrets, then re-run the workflow. |
| “Missing Supabase environment variable(s)” | Re-run the workflow so the secrets step runs again. |
| Provider keys show as unreadable | `PROVIDER_ENC_KEY` was changed — restore the original value. |