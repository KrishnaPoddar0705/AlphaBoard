# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AlphaBoard — a full-stack stock research and analyst recommendation platform. Users track recommendations, portfolios, performance metrics, and engage in community discussions. Includes a WhatsApp bot for mobile access.

## Repository Structure

- **`frontend/`** — React 19 + Vite SPA (TypeScript, Tailwind CSS)
- **`backend/`** — FastAPI Python API (market data, AI features, recommendations)
- **`whatsapp-bot/`** — WhatsApp chatbot service (FastAPI)
- **`database/`** — Supabase PostgreSQL migrations
- **`scripts/`** — Clerk auth migration/config utilities
- **`ios/`** — Capacitor iOS build

## Commands

### Frontend (run from `frontend/`)
```bash
npm run dev        # Vite dev server
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend (run from `backend/`)
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### WhatsApp Bot (run from `whatsapp-bot/`)
```bash
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8001
pytest tests/ -v
```

## Frontend Architecture

- **Routing**: React Router v7 in `App.tsx`. Public routes (`/community`, `/stock/:ticker`), private routes wrapped in `PrivateRoute` (Clerk auth).
- **Path alias**: `@/` maps to `frontend/src/` (configured in `vite.config.ts`).
- **API client**: `src/lib/api.ts` — Axios instance. Uses `VITE_API_URL` env var, falls back to Render prod URL or localhost.
- **State**: React Context (Theme, Search, StockPanel) + TanStack React Query for server state.
- **Auth**: Clerk (`@clerk/clerk-react`). `PrivateRoute` shows `InlineLogin` for unauthenticated users.
- **Styling**: Tailwind CSS with custom paper theme (background `#F1EEE0`, ink `#1C1B17`). Design tokens in `src/design-tokens.ts`.
- **UI components**: Radix UI primitives in `src/components/ui/` (shadcn-style).
- **Charts**: Nivo (primary), Recharts, Highcharts.
- **Feature flags**: `src/config/featureFlags.ts` — env vars (`VITE_UI_V2`, etc.) or `localStorage`. Hook: `useFeatureFlag`.

## Backend Architecture

- **Entry point**: `app/main.py` (large file ~141KB with all routes).
- **Database**: Supabase client in `app/db.py`. Service role key bypasses RLS.
- **Market data**: `app/market.py` via yFinance.
- **AI features**: OpenAI API for news summaries (`app/news.py`), investment thesis (`app/thesis.py`), podcast scripts (`app/podcast.py`).
- **Background jobs**: APScheduler with CronTrigger for price updates and performance cache refresh.
- **Models**: Pydantic in `app/models.py`.

## Key Conventions

- **Mobile-first UI**: All layout changes must work on mobile first, then scale up. Use `hidden md:block` for responsive panels. Tabs/accordions for secondary content on small screens.
- **Component size limit**: Keep components under ~300 LOC; extract sub-components as needed.
- **No unauthorized library additions**: Get approval before adding new frontend dependencies.
- **Don't alter backend recommendation math** without explicit approval.

## Deployment

See `FLY_DEPLOYMENT.md` for the full runbook.

- **Frontend**: Cloudflare Pages (root `frontend/`, build `npm run build`, output `dist/`). Requires `NODE_VERSION=22`; all `VITE_*` vars are **build-time**.
- **Backend**: Fly.io app `alphaboard-backend`, region `sin` — `backend/fly.toml`
- **WhatsApp bot**: Fly.io app `alphaboard-whatsapp-bot`, region `sin` — `whatsapp-bot/fly.toml`
- **Production URLs**: `alphaboard.theunicornlabs.com` (frontend), `alphaboard-backend.fly.dev` (backend), `alphaboard-whatsapp-bot.fly.dev` (bot)

**The backend must stay a single always-on machine.** `app/main.py:53` runs an
in-process APScheduler with two 10:00 UTC cron jobs. Auto-stop makes them
silently skip; a second machine makes them run twice. Never set
`auto_stop_machines` on, and never `fly scale count` above 1 — move the
scheduler out of the web process first.

The bot reaches the backend over Fly private networking
(`http://alphaboard-backend.internal:8000`), not the public URL.

Dependencies are pinned in `requirements.lock` in each Python service; the
images install from the lock, so editing `requirements.txt` alone changes
nothing until you regenerate it.

## Environment Variables

Frontend (in `frontend/.env`): `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

Backend (in `backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`
