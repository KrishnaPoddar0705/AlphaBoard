import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * Fail the build if any VITE_* variable holds a value that must never be
 * public.
 *
 * Vite inlines every VITE_* variable into the JS bundle at build time, so a
 * secret placed in one is served to every visitor. A runtime check in the app
 * is not enough — by the time it runs, the bundle containing the secret has
 * already been downloaded.
 *
 * This is not hypothetical: VITE_CLERK_PUBLISHABLE_KEY was once set to an
 * sk_live_ value in Cloudflare Pages, which published the Clerk production
 * secret key — full Backend API access, including listing every user's email
 * and minting sessions for any account — on the live site until it was noticed
 * and rotated. The build succeeded and the deploy was green; only the browser
 * showed anything wrong, and only as a generic error page.
 *
 * Secret-shaped prefixes, deliberately broad: it is better to block a build on
 * a false positive than to publish a credential.
 */
const SECRET_PREFIXES = [
  'sk_',      // Clerk secret key, Stripe secret key
  'rk_',      // Clerk / Stripe restricted key
  'sk-',      // OpenAI
  'service_role',
  'SG.',      // SendGrid
  'ghp_',     // GitHub personal access token
  'github_pat_',
  'xoxb-',    // Slack bot token
]

function forbidSecretsInClientEnv(mode: string) {
  return {
    name: 'forbid-secrets-in-client-env',
    // `config` runs before any bundling, so the build stops before a secret
    // can be written into an asset.
    config() {
      const env = loadEnv(mode, path.resolve(__dirname), 'VITE_')
      const offenders: string[] = []

      for (const [name, value] of Object.entries(env)) {
        if (typeof value !== 'string' || !value) continue
        const hit = SECRET_PREFIXES.find((p) => value.startsWith(p))
        // Never print the value itself — this output reaches CI logs.
        if (hit) offenders.push(`${name} (value begins with "${hit}")`)
      }

      if (offenders.length) {
        throw new Error(
          '\n\nBuild refused: a VITE_* variable contains what looks like a secret.\n\n' +
          offenders.map((o) => `  - ${o}`).join('\n') +
          '\n\nVITE_* variables are inlined into the public JS bundle and served to\n' +
          'every visitor. If this value is a real credential, rotate it now — it is\n' +
          'compromised the moment a build ships.\n\n' +
          'Clerk specifically: the frontend takes the PUBLISHABLE key (pk_...), not\n' +
          'the secret key (sk_...). The secret key belongs in backend environments\n' +
          'only, such as Supabase edge function secrets.\n'
        )
      }
    },
  }
}

/**
 * Top-level path segments owned by the FastAPI backend, proxied in dev.
 *
 * Taken from the `@app.<method>("/...")` decorators in backend/app/main.py. Add a
 * segment here when a new top-level route appears there, or the dev server will try to
 * answer it with index.html and the caller will get HTML where it expected JSON.
 */
const BACKEND_ROUTE_PREFIXES = [
  '/market',
  '/recommendations',
  '/watchlist',
  '/leaderboard',
  '/price-targets',
  '/news',
  '/api',
  '/admin',
  '/health',
  '/update-stats',
]

/**
 * Dev-only proxy to the backend.
 *
 * Without it the browser calls the backend cross-origin, which only works while the
 * dev server happens to be on a port the backend's CORS allowlist names
 * (backend/app/main.py lists 5173-5175). Vite increments the port whenever one is
 * busy, so a second dev server lands on 5176 and every market request starts failing
 * CORS with no obvious cause. Proxying makes the requests same-origin, so the port
 * stops mattering.
 *
 * The target defaults to the deployed backend so `npm run dev` works with nothing else
 * running. Point DEV_API_PROXY_TARGET at http://127.0.0.1:8000 when you are running
 * the backend locally. Note this is NOT a VITE_ variable: it is read here, in Node, and
 * never inlined into the client bundle.
 */
function backendProxy(mode: string) {
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const target = env.DEV_API_PROXY_TARGET || 'https://alphaboard-backend.fly.dev'

  return Object.fromEntries(
    BACKEND_ROUTE_PREFIXES.map((prefix) => [
      prefix,
      {
        target,
        changeOrigin: true,
        // The deployed backend is HTTPS; a local one is plain HTTP.
        secure: target.startsWith('https://'),
      },
    ])
  )
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    forbidSecretsInClientEnv(mode),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: backendProxy(mode),
  },
  resolve: {
    alias: {
      // Force all imports to use the top-level installed react
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      // Path alias for @/ imports
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['d3-format', 'd3-scale', 'd3-time-format'],
  },
}))
