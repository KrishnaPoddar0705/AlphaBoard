# Running AlphaBoard locally

This covers the frontend, the FastAPI backend and the optional edge-function container,
with the Thinking Board as the worked example.

## How the pieces connect

```
browser ── http://localhost:5173  (Vite, frontend/)
   │
   ├── /api, /market, /news ...  ──►  Vite dev proxy  ──►  DEV_API_PROXY_TARGET
   │                                                        default: https://alphaboard-backend.fly.dev
   │                                                        local:   http://127.0.0.1:8010  (FastAPI)
   │
   ├── Command Center reads/writes ──►  hosted Supabase (VITE_SUPABASE_URL), under your login
   │
   └── sign-in sync (sync-clerk-user) ──►  VITE_EDGE_FUNCTIONS_URL if set (local Docker, :8000)
                                         otherwise the deployed edge function
```

There is no local database. Local runs use the **hosted Supabase project**, the same
one production uses. Anything you save locally is real data.

## Which setup do you need?

| You want to... | Frontend | Backend | Docker |
|---|---|---|---|
| Browse the app, work on UI that only reads Supabase | yes | no (proxy uses Fly) | no |
| Use the **Thinking Board** connectors (`/api/board/sources/*`) | yes | **yes, local** | no |
| Work on the `sync-clerk-user` edge function itself | yes | optional | yes |

The Thinking Board needs a local backend until it is deployed: the Fly backend does
not have `/api/board/sources/*` yet, so connector pulls fail with "No source had this
data" (404) or "Could not reach the AlphaBoard data service".

---

## 1. One-time setup

### Frontend env (`frontend/.env`)

Two lines matter:

```bash
# Send API calls to your local backend (not a VITE_ variable; read by vite.config.ts).
DEV_API_PROXY_TARGET=http://127.0.0.1:8010

# Comment this out unless the Docker edge-function container is running (step 4).
# While it is set and nothing listens on :8000, sign-in never reaches Supabase and
# Command Center says "Not signed in to the database yet".
# VITE_EDGE_FUNCTIONS_URL=http://127.0.0.1:8000
```

Restart `npm run dev` after any `.env` change. Vite reads it only at startup.

### Backend env (`backend/.env`)

These should already be set: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`,
`FINNHUB_API_KEY`. The Thinking Board adds one **optional** key:

```bash
DRISHTI_API_KEY=...   # concall, announcements, news and results from Drishti.
                      # Leave it out and those use Screener.in / Yahoo instead.
```

### Database migration (once per Supabase project)

The Thinking Board's tables do not exist until you run
`database/migration_command_center_thinking_board.sql`:

1. Open the Supabase dashboard, then **SQL Editor**.
2. Paste in the whole file and run it.
3. Reload the app.

If you skip this, the Thinking Board's note list says *"the Thinking Board tables are
not in the database yet"*.

### Dependencies

```bash
cd frontend && npm install          # picks up the TipTap editor packages

cd ../backend
python3 -m venv venv                # skip if backend/venv already exists
venv/bin/pip install -r requirements.lock
```

---

## 2. Start the backend

```bash
cd backend
venv/bin/uvicorn app.main:app --reload --port 8010
```

Use **port 8010, not 8000**. Port 8000 belongs to the `sync-clerk-user` Docker container
on this machine (step 4), and the two cannot share it. If you need a different port,
change `DEV_API_PROXY_TARGET` to match.

To check it is up:

```bash
curl localhost:8010/health
# {"status":"healthy"}

curl "localhost:8010/api/board/sources/pnl?ticker=COASTCORP.NS"
# {"detail":"Sign in to pull research data."}   <- correct: the route requires a login
```

> **Do not leave it running across 10:00 UTC (15:30 IST).** `app/main.py` starts the
> in-process scheduler, so a local backend runs the daily price and returns jobs against
> the production database too. Those jobs would then run twice that day. Stop it when you
> are done.

## 3. Start the frontend

```bash
cd frontend
npm run dev
```

Open <http://localhost:5173/command-center?view=thinking> and sign in with Clerk as usual.

To try it out:

1. Click **New board** and pick a stock. A stock not yet in coverage asks for a sector first.
2. Write in the page. Type `/` for formatting and data pulls.
3. Pull **Income statement** from the right-hand rail. A card should appear with source
   *Screener.in*.
4. Click **Insert in note**.
5. Click **Publish to log**. The entry should appear on `/command-center/stock/<TICKER>`.

## 4. Optional: the edge-function container

You only need this when changing `supabase/functions/sync-clerk-user`. Everyone else
should leave `VITE_EDGE_FUNCTIONS_URL` unset and use the deployed function.

```bash
cd supabase/functions/sync-clerk-user
docker run -d --name sync-clerk-user --rm -p 8000:8000 -v "$PWD":/w -w /w \
  --env-file /path/to/sync-clerk-user.env \
  --entrypoint deno denoland/deno:alpine-2.1.4 \
  run --allow-net --allow-env --no-lock index.ts
```

The env file needs:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`. This is the same value as `SUPABASE_SERVICE_KEY` in
  `backend/.env`, under a different name.

Pass secrets with `--env-file`, never `-e KEY=value`. Inline values end up in your shell
history.

Then set `VITE_EDGE_FUNCTIONS_URL=http://127.0.0.1:8000` in `frontend/.env` and restart
Vite. To check the container is up, without touching the database:

```bash
curl -s -X POST localhost:8000/sync-clerk-user -d '{}'
# {"error":"clerkUser with clerkUserId and email is required"}
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Not signed in to the database yet" | `VITE_EDGE_FUNCTIONS_URL` points at :8000 and Docker is not running | Comment it out (or start step 4), then restart Vite |
| Connector card: "Could not reach the AlphaBoard data service" | Backend not running, or `DEV_API_PROXY_TARGET` wrong or missing | Start step 2; check the port matches; restart Vite |
| Connector card: 404 for every connector | Proxy still going to Fly (no `DEV_API_PROXY_TARGET`) | Set it, then restart Vite |
| "Your session expired" on a pull | Supabase token rejected by the backend | Reload the page; check `backend/.env` points at the same project as `VITE_SUPABASE_URL` |
| "Thinking Board tables are not in the database yet" | Migration not applied | Run the SQL file (step 1) |
| `uvicorn`: address already in use | Something else holds the port | `lsof -nP -iTCP:8010 -sTCP:LISTEN`, then pick a free port and update the proxy target |
| Requests to :8000 hang instead of failing | Docker Desktop daemon is wedged | `curl --max-time 5 --unix-socket ~/.docker/run/docker.sock http://localhost/_ping`. If it times out: `pkill -9 -f "MacOS/com.docker"`, `rm -f ~/.docker/run/docker.sock`, `open -a Docker` |
| Ratios or Shareholding: "No source had ... data" for a US ticker | Those come from Screener only (Indian listings) | Expected |

## Tests

```bash
cd frontend && npx vitest run          # includes docToMarkdown.test.ts
cd backend && venv/bin/python -m pytest tests/test_screener.py   # needs: venv/bin/pip install pytest
```
