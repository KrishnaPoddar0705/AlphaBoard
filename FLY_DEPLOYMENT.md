# Fly.io + Cloudflare Pages Deployment

Supersedes `RENDER_DEPLOYMENT.md`, `RENDER_DEPLOYMENT_SUMMARY.md`, `RENDER_ENV_SETUP.md`,
`deploy-to-render.sh` and `render.yaml`. Those stay in the repo until Render is
torn down (Step 7), then go.

## Where things live after this migration

| Service | Was | Now | Config |
|---|---|---|---|
| Backend API | Render web service | Fly.io app `alphaboard-backend`, region `sin` | `backend/fly.toml` |
| WhatsApp bot | Render web service | Fly.io app `alphaboard-whatsapp-bot`, region `sin` | `whatsapp-bot/fly.toml` |
| Frontend SPA | Render static site | Cloudflare Pages | `frontend/public/_redirects`, `_headers` |

The frontend went to Pages rather than Fly on purpose: Fly has no static-site
product, so a React SPA there means paying for a VM in one region instead of
using a free global CDN.

## The one constraint that governs the backend

`backend/app/main.py:53` starts an in-process `BackgroundScheduler` with two
`CronTrigger` jobs at 10:00 UTC (`main.py:3173-3186`) — the daily price update
and the performance-cache refresh.

That makes the backend a **singleton that must never sleep**:

- **Never enable auto-stop.** A stopped machine has no running process, so it
  skips both jobs silently — nothing errors, because nothing is alive to fail.
  Traffic is quiet at 10:00 UTC, which is exactly when auto-stop would trigger.
- **Never scale past one machine.** Two machines mean two schedulers, and both
  jobs run twice.

`backend/fly.toml` encodes both (`auto_stop_machines = 'off'`,
`min_machines_running = 1`), and Step 1 pins the machine count. If you ever need
real horizontal scale, the scheduler has to move out of the web process first —
to a separate Fly app, a Fly scheduled machine, or Supabase pg_cron.

The WhatsApp bot has no scheduler, so it gets the opposite settings and costs
nothing while idle.

## Prerequisites

```bash
fly version          # already installed at ~/.fly/bin/fly
fly auth login
fly orgs list        # note the org slug you want to deploy into
```

Docker Desktop does not need to be running — Fly builds on a remote builder by
default. If you'd rather build locally, start Docker and add `--local-only`.

---

## Step 1 — Backend to Fly

```bash
cd backend
fly apps create alphaboard-backend --org personal   # use your org slug
```

> Use `fly apps create`, **not** `fly launch`. `fly launch` regenerates
> `fly.toml` from its own template and would overwrite the scheduler-safety
> settings above.

Set secrets. These are the same values currently in the Render backend
dashboard — nothing is read from `backend/.env`, which is gitignored and never
enters the image:

```bash
fly secrets set --app alphaboard-backend \
  SUPABASE_URL="https://odfavebjfcwsovumrefx.supabase.co" \
  SUPABASE_SERVICE_KEY="<service role key>" \
  OPENAI_API_KEY="<openai key>"

# Optional, only if the corresponding features are in use:
fly secrets set --app alphaboard-backend \
  FINNHUB_API_KEY="..." \
  NEWSAPI_KEY="..." \
  NOTION_API_KEY="..." \
  NOTION_DATABASE_ID="..."
```

Deploy and pin to exactly one machine:

```bash
fly deploy --config fly.toml
fly scale count 1 --app alphaboard-backend
```

Verify:

```bash
curl https://alphaboard-backend.fly.dev/health
# {"status":"healthy"}

curl https://alphaboard-backend.fly.dev/
# {"message":"Analyst Leaderboard API"}

fly status --app alphaboard-backend   # MUST show exactly 1 machine, state=started
fly logs --app alphaboard-backend
```

In the logs, confirm APScheduler started and that you see **one** scheduler
instance, not two.

---

## Step 2 — WhatsApp bot to Fly

```bash
cd ../whatsapp-bot
fly apps create alphaboard-whatsapp-bot --org personal
```

```bash
fly secrets set --app alphaboard-whatsapp-bot \
  META_WHATSAPP_ACCESS_TOKEN="..." \
  META_WHATSAPP_PHONE_NUMBER_ID="..." \
  META_WHATSAPP_VERIFY_TOKEN="..." \
  SUPABASE_URL="https://odfavebjfcwsovumrefx.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
  ADMIN_API_KEY="..."
```

`ALPHABOARD_API_BASE_URL` and `ENVIRONMENT` are already set in
`whatsapp-bot/fly.toml` — do not also set them as secrets, or the secret wins
and you lose the private-networking address.

```bash
fly deploy --config fly.toml
```

Verify, including the private link to the backend:

```bash
curl https://alphaboard-whatsapp-bot.fly.dev/health
# {"status":"healthy"}

# /docs must 404 — ENVIRONMENT=prod disables it (main.py:79)
curl -o /dev/null -w '%{http_code}\n' https://alphaboard-whatsapp-bot.fly.dev/docs

# Confirm the bot reaches the backend over Fly's private mesh
fly ssh console --app alphaboard-whatsapp-bot \
  -C "curl -s http://alphaboard-backend.internal:8000/health"
# {"status":"healthy"}
```

That last command is the one worth running. `.internal` only resolves between
apps in the same Fly organization — if both apps aren't in the same org, it
fails here rather than in production.

---

## Step 3 — Frontend to Cloudflare Pages

Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect
to Git** → `KrishnaPoddar0705/AlphaBoard`.

Build configuration:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `frontend` |

Environment variables — set for **both** Production and Preview:

```
NODE_VERSION               = 22
VITE_CLERK_PUBLISHABLE_KEY = pk_live_...        (see note below)
VITE_SUPABASE_URL          = https://odfavebjfcwsovumrefx.supabase.co
VITE_SUPABASE_ANON_KEY     = <anon key>
VITE_API_URL               = https://alphaboard-backend.fly.dev
VITE_WHATSAPP_BOT_API_URL  = https://alphaboard-whatsapp-bot.fly.dev
```

Two things that will bite otherwise:

- **`NODE_VERSION=22` is not optional.** Vite 7 requires Node 20.19+ / 22.12+.
  Pages defaults to an older Node and the build fails on a confusing syntax
  error rather than a clear version message.
- **`VITE_*` variables are build-time.** Vite substitutes them into the bundle
  during `npm run build`; they do not exist at runtime. A missing
  `VITE_CLERK_PUBLISHABLE_KEY` produces a clean build that ships `undefined` and
  fails in the browser — the exact failure `RENDER_ENV_SETUP.md` documents.
  `RENDER_ENV_SETUP.md` also notes production should use a `pk_live_` key; this
  is a good moment to stop shipping the `pk_test_` one.

SPA routing needs no dashboard configuration — `frontend/public/_redirects` is
honoured natively by Pages. This is the first platform where that file actually
does anything (Render ignored it).

---

## Step 4 — Point the external services at Fly

Nothing user-facing has changed yet. Render is still serving production. These
four are outside the repo and are the easiest to forget:

1. **Meta WhatsApp webhook** — Meta for Developers → your app → WhatsApp →
   Configuration → Callback URL:
   `https://alphaboard-whatsapp-bot.fly.dev/webhook`
   Verify token must match `META_WHATSAPP_VERIFY_TOKEN`. Click **Verify and
   save** and confirm Meta's GET challenge succeeds.

2. **Supabase edge function** — set the backend URL for the price-alert
   function so it stops calling Render. **Run from the repository root**, not
   from `backend/` or `whatsapp-bot/` where the previous steps leave you:
   ```bash
   cd /Users/krishna.poddar/leaderboard      # repo root — required
   supabase secrets set BACKEND_API_URL=https://alphaboard-backend.fly.dev
   supabase functions deploy check-price-alerts
   ```
   The Supabase CLI resolves `./supabase/functions/<name>/index.ts` against the
   current directory and does not search parent directories the way git or npm
   do. From the wrong directory the deploy fails with `entrypoint path does not
   exist` — and the CLI quietly creates a stray `supabase/.temp/` there, which
   is where the empty `frontend/supabase/` and `whatsapp-bot/supabase/`
   directories came from.

   `supabase secrets set` is an API call against the linked project ref and
   works from anywhere, so a failed deploy after a successful secrets set does
   not need the secret re-applied.

3. **Clerk allowed origins** — add the Pages origin
   (`https://alphaboard.pages.dev`) plus your custom domain. Either run
   `scripts/configure-clerk-domain.ts`, which now includes it, or add it in the
   Clerk dashboard.

4. **Custom domain** — in Pages → Custom domains, add
   `alphaboard.theunicornlabs.com` and `www.alphaboard.theunicornlabs.com`, then
   update the DNS records away from Render. **Do this last**, after Step 5
   passes.

---

## Step 5 — Verify before cutting over

Against the Pages preview URL, with Render still live:

- [ ] App loads, no "Missing Clerk Publishable Key" in the console
- [ ] Sign-in works (Clerk origin is allowed)
- [ ] Leaderboard and recommendations load — confirms the backend and CORS
- [ ] Hard-refresh on a deep link (`/stock/AAPL`, `/community`) returns the
      right page, not a 404 and not a bounce to `/community`
- [ ] A stock detail page renders prices — confirms yfinance works from `sin`
- [ ] WhatsApp: send the bot a message, confirm a reply
- [ ] DevTools → Application → Service Workers shows the worker unregistering
      itself rather than intercepting requests
- [ ] `fly status --app alphaboard-backend` still shows exactly **1** machine

The scheduler is the one thing you cannot verify in minutes. After the first
10:00 UTC passes, check that the jobs ran once:

```bash
fly logs --app alphaboard-backend | grep -i "scheduler\|price update\|performance"
```

---

## Step 6 — Cut over

Only after Step 5 is green: repoint DNS for `alphaboard.theunicornlabs.com` to
Cloudflare Pages.

**Rollback** is DNS back to Render. Render keeps running untouched throughout,
so the old stack is always one DNS change away. Keep it up for a few days.

---

## Step 7 — Tear down Render

Once you're confident, and not before:

1. Delete the Render services (`srv-d4mvrpvpm1nc73d9jpvg` backend,
   `srv-d4mvjl49c44c738cij60` static site, and the WhatsApp bot service).
2. Remove the Render origin from the parallel-running allowlists, all three
   marked with a comment saying so:
   - `backend/app/main.py` (CORS `allow_origins`)
   - `frontend/src/config/allowedOrigins.ts`
   - `scripts/configure-clerk-domain.ts`
3. Delete `render.yaml`, `deploy-to-render.sh`, `RENDER_DEPLOYMENT.md`,
   `RENDER_DEPLOYMENT_SUMMARY.md`, `RENDER_ENV_SETUP.md`.
4. Later, once pre-migration browsers have aged out, delete
   `frontend/public/sw.js` and the registration block in `frontend/index.html`.

---

## Troubleshooting

### `no capacity available in <region>`

```
Error: error creating a new machine: failed to launch VM:
no capacity available in bom
```

Fly could not allocate hardware in that region. It is not a config error and
retrying the same region usually does not help — smaller regions like `bom`
(Mumbai) run out regularly.

Both apps are set to `sin` (Singapore) for this reason. If `sin` is also full,
edit `primary_region` in **both** `backend/fly.toml` and
`whatsapp-bot/fly.toml` and redeploy. Keep them identical — they communicate
over Fly's private network, and splitting them across regions turns an
intra-datacenter hop into a cross-region one.

Nearby fallbacks, roughly in order of preference: `sin` → `hkg` (Hong Kong) →
`nrt` (Tokyo) → `syd` (Sydney).

A failed launch can leave the app created but with no machine, or with a
machine stuck in `created`. Check and clean up before redeploying:

```bash
fly status --app alphaboard-backend
fly machine list --app alphaboard-backend
fly machine destroy <machine-id> --force --app alphaboard-backend   # if stuck
fly deploy --config fly.toml
```

The app itself does not need recreating — `fly apps create` is only required
once, and `primary_region` is read from `fly.toml` on every deploy.

## Routine operations

```bash
fly deploy --config fly.toml            # from backend/ or whatsapp-bot/
fly logs --app alphaboard-backend
fly ssh console --app alphaboard-backend
fly secrets list --app alphaboard-backend      # names only, never values
fly status --app alphaboard-backend
```

Updating dependencies — the lock files are what the images install, so editing
`requirements.txt` alone changes nothing:

```bash
cd backend
uv pip compile requirements.txt --python-version 3.13 \
  --python-platform x86_64-unknown-linux-gnu --output-file requirements.lock
```

The WhatsApp bot's regeneration command, which strips test dependencies, is in
the header of `whatsapp-bot/requirements.lock`.

## Notes

- Setting a secret restarts the app. Batch them into one `fly secrets set`.
- The backend runs one uvicorn worker deliberately (scheduler). Concurrency
  comes from asyncio inside that worker.
- Backend memory is 1GB, not the 512MB default: pandas, numpy and yfinance
  resident in one process, plus the DataFrame work in `performance.py`, will OOM
  a 512MB machine.
- Fly free `*.fly.dev` hostnames get TLS automatically; `force_https` is on for
  both apps.
