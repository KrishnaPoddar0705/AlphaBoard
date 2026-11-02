# AlphaBoard landing site

The public marketing site: Astro 7, static output, Cloudflare Pages Functions for
AI-crawler tracking and the demo form. Separate from the app in `frontend/`.

## Commands (run from `landing/`)

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # -> dist/ (HTML, markdown mirrors, llms.txt, sitemap)
npm run check     # astro check (types)
npm run preview
npx wrangler pages dev dist --compatibility-date=2026-04-01   # with Functions
```

Astro 7 needs Node >= 22.23.4 (or 24+), so a 22.23.1 install will refuse to build. Cloudflare builds with `NODE_VERSION=22`.

## Deploy (Cloudflare Pages, separate project)

Project `alphaboard-landing`, live at https://alphaboard-landing.pages.dev. Direct upload:

```bash
npm run build && npx wrangler pages deploy dist --project-name alphaboard-landing --branch main
```

For a git-connected build instead, use:

| Setting | Value |
|---|---|
| Root directory | `landing` |
| Build command | `npm run build` |
| Output | `dist` |
| `NODE_VERSION` | `22` |

Environment variables:

| Name | Where | What |
|---|---|---|
| `PUBLIC_POSTHOG_KEY` | build | PostHog project key (browser) |
| `PUBLIC_POSTHOG_HOST` | build, optional | default `https://us.i.posthog.com` |
| `PUBLIC_APP_URL` | build, optional | "Sign in" target; default `https://alphaboard.theunicornlabs.com/` |
| `POSTHOG_KEY` | runtime (Functions) | same project key, for `ai_crawler_visit` and `demo_request_received` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | runtime (Functions, secret) | demo requests table |

Before the first demo request, apply `database/migrations/migration_add_demo_requests.sql`.

The production domain is one line in `site.config.mjs` (canonical URLs, sitemap,
robots, llms.txt all derive from it).

## Where things live

- `src/data/` is the content: `pages.ts` (solutions and product pages), `connectors.ts`
  (one list for /integrations, the home table, llms files), `faq.ts`, `agents.ts`,
  `board.ts` and `desk.ts` (illustrative desk data; companies are fictional on purpose).
- `src/components/home/` holds the home sections; `src/components/sections/` holds the
  shared page sections; `src/components/ui/` holds product fragments marked `data-ui`.
- `src/lib/markdown.ts` builds the `.md` mirrors, `llms.txt` and `llms-full.txt` from the same data.
- `functions/_middleware.ts` handles AI crawler tracking and `Accept: text/markdown`.
- `functions/api/demo.ts` stores demo requests.
- Photographs: `src/assets/images/` (credits in `src/data/photo-credits.json`, printed
  in the footer). Film: `public/media/`.

## Design rules

Direction "colour chapters" (taste-skill v2, seed 1485908085), idea "the firm's book": the page
is a bound ledger read front to back, after the red bahi-khata of Indian merchant houses.
Paper `#f1eee0` and ink `#1c1b17` are the product's own colours; ledger red `#7c1d1f` is the
binding, with one banker's green field. Newsreader for display and IBM Plex Sans for text, both
self-hosted (the type slot was overridden to the product's family; `ibm-plex-sans-latin-ext` holds ₹).

- **The live thing:** one note. `src/data/desk.ts` is a fictional desk; `src/lib/desk-render.ts`
  renders the Matrix and answers at build time and in the browser; `src/lib/desk.ts` mounts the
  fragments in `src/components/ui/Desk*.astro`. Publishing on the Thinking Board adds the entry to
  both Matrices. **It stops there on purpose:** the Brain reads uploaded reports (`research_reports`),
  not log entries (`cc_events`). Do not show a published note in a Brain answer until that is built.
- **Diamonds:** three Paper shaders (`@paper-design/shaders` 0.0.82, vanilla) mounted from
  `src/lib/diamonds.ts` on `[data-diamond="main|metal|heat"]`, home page only and only on dark
  chapters (they read badly on paper). Each pauses off-screen. The house style's no-glow rule is
  waived for these at the client's request.
- **Chapters:** `.chapter` plus `--ink`, `--red`, `--green`, `--tone` in `global.css`. Fields butt
  together with hard edges. Square corners on the page; `--ui-radius` inside `data-ui` fragments.
- **Scroll:** `lenis` (`src/lib/scroll.ts`; off under reduced motion and in automated browsers).
- **Pages:** two product pages (`/product/matrix`, `/product/company-brain`, labelled Institutional
  Memory; the URL is kept) and four solutions plus `/solutions`, from `src/data/pages.ts` through
  `components/sections/PageTemplate.astro`. Old URLs redirect in `public/_redirects`.
- **Copy rules:** no Svan View, no benchmark or alpha comparisons. LP views, filings feeds and global
  data are described as roadmap until they ship. Never "cited to the exact page" (page location is
  best effort), never "verified" on a source chip, no encryption, residency or certification claims
  the code cannot show. Scanned PDFs are not read.

`film/` holds the old HyperFrames sources; the site no longer uses `brain-film.mp4` or
`consolidate.mp4`. No eyebrows, gradients, monospace, glass or shadows at rest. Check with:

```bash
node ../.claude/skills/design-taste-frontend/scripts/lint.mjs src
node ../.claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:4321/
```

Honesty rules: no invented customers, logos, testimonials or AUM. Connector status is
Live only when it exists in the codebase. Sample data is labelled illustrative.
