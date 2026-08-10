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

3. **Clerk and the custom domain** — these are one task, not two. See the
   dedicated section below.

---

## Step 4b — Clerk production and the custom domain

**Read this before setting a `pk_live_` key.** Doing it in the wrong order takes
sign-in down completely, with no error on screen.

### Why the order matters

A Clerk **development** instance accepts any origin — `localhost`,
`*.pages.dev`, anything. A **production** instance accepts only its own
registrable domain. Point a `pk_live_` key at `alphaboard.pages.dev` and Clerk
answers:

```json
{"code": "origin_invalid",
 "long_message": "The Request HTTP Origin header must be equal to or a
                  subdomain of the requesting URL."}
```

The app does not show an error. `PrivateRoute` (`frontend/src/App.tsx:30-46`)
checks `isLoaded` before it checks `user`, so a Clerk that never initialises
leaves every private route rendering `Loading...` forever, and `<InlineLogin />`
on line 42 is never reached. The symptom is "the sign-in button disappeared".

A second, distinct rejection applies even on the right domain until the exact
hostname is allowlisted:

```json
{"code": "subdomain_not_allowed",
 "long_message": "The request origin subdomain is not in the allowed
                  subdomains list."}
```

### Correct order

1. **Add the custom domain in Pages first.** Pages → the project → Custom
   domains → add `alphaboard.theunicornlabs.com` (and optionally the `www.`
   form). `theunicornlabs.com` is already on Cloudflare, so the DNS record is
   created for you. Confirm before continuing:
   ```bash
   dig +short alphaboard.theunicornlabs.com     # must return records
   curl -sI https://alphaboard.theunicornlabs.com | head -1
   ```

2. **Allowlist that exact hostname in Clerk**, or `subdomain_not_allowed`
   blocks it:
   ```bash
   export CLERK_SECRET_KEY=sk_live_...          # PRODUCTION secret key
   npx tsx scripts/configure-clerk-domain.ts alphaboard.theunicornlabs.com
   ```
   The script merges into the existing `frontend_api.allowed_origins` rather
   than replacing it. Do not add `*.pages.dev` or `localhost` — a production
   instance rejects those before consulting the list, so they appear to be
   configured and silently do nothing.

3. **Split the keys by environment.** Preview deployments are always
   `*.pages.dev` and can never work with a production key:

   | Pages environment | `VITE_CLERK_PUBLISHABLE_KEY` |
   |---|---|
   | Production | `pk_live_...` |
   | Preview | `pk_test_...` (development instance) |

   **`pk_`, never `sk_`.** Clerk issues both a publishable key (`pk_`) and a
   secret key (`sk_`) per instance, and they differ by two characters. Every
   `VITE_*` variable is inlined into the public JS bundle, so putting the
   secret key here publishes full Clerk Backend API access — listing every
   user's email, deleting users, minting sessions for any account — to every
   visitor. It has happened on this project: `VITE_CLERK_PUBLISHABLE_KEY` was
   set to an `sk_live_` value, the build went green, the deploy succeeded, and
   the only visible symptom was a generic "Something went wrong" page, because
   Clerk rejects the malformed key *after* the bundle has already shipped.

   `frontend/vite.config.ts` now refuses to build when a `VITE_*` variable
   starts with a secret-shaped prefix, so this fails in CI rather than in
   production. If that check ever fires on a real credential, rotate the
   credential — do not just correct the variable.

4. **Update `CLERK_SECRET_KEY` for the edge functions.** It is not only a
   frontend concern — `supabase/functions/create-organization/index.ts` and
   `join-organization/index.ts` both call the Clerk Backend API with it.
   Organization create/join breaks if it still holds the development key:
   ```bash
   supabase secrets set CLERK_SECRET_KEY=sk_live_...
   supabase functions deploy create-organization
   supabase functions deploy join-organization
   ```

5. **Remap the users.** Development and production instances have separate user
   pools, so every existing user receives a new Clerk ID on first production
   sign-in — matching nothing in `public.clerk_user_mapping`, which the backend
   resolves every request through. Their data becomes unreachable until:
   ```bash
   export CLERK_PROD_SECRET_KEY=sk_live_...
   export SUPABASE_URL=... SUPABASE_SERVICE_KEY=...

   npx tsx scripts/remap-clerk-mapping-to-prod.ts            # dry run
   npx tsx scripts/remap-clerk-mapping-to-prod.ts --apply
   ```
   Run it after users have signed in to production at least once; anyone who
   has not is reported as unmatched. It is idempotent, backs the table up
   before writing, and refuses to run against a non-`sk_live_` key.

### Verify

```bash
curl -s "https://clerk.theunicornlabs.com/v1/client?__clerk_api_version=2021-02-05" \
  -X POST -H "Origin: https://alphaboard.theunicornlabs.com"
```

Anything mentioning `origin_invalid` or `subdomain_not_allowed` means step 1 or
2 is incomplete. Then load a private route (`/recommendations`) and confirm it
resolves to either content or a sign-in form — never a stuck `Loading...`.

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
