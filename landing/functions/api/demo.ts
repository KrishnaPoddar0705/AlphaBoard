/**
 * POST /api/demo: stores a demo request in Supabase (`public.demo_requests`, see
 * database/migrations/*_demo_requests.sql) and records it in PostHog.
 *
 * Accepts JSON (the page's fetch) or a plain form post (no-JS fallback, which is
 * redirected back to /demo?sent=1). Env: SUPABASE_URL, SUPABASE_SERVICE_KEY,
 * optional POSTHOG_KEY / POSTHOG_HOST.
 */
interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
}
interface Ctx { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void }

const FIELDS = ['name', 'email', 'firm', 'role', 'firm_type', 'aum_band', 'team_size', 'message', 'connector', 'source'] as const;
type Field = (typeof FIELDS)[number];
const MAX: Partial<Record<Field, number>> = { message: 2000, source: 500 };
const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|live|icloud|rediffmail|proton)\./i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const onRequestPost = async ({ request, env, waitUntil }: Ctx): Promise<Response> => {
  const isJson = (request.headers.get('content-type') || '').includes('application/json');
  let raw: Record<string, unknown>;
  try {
    raw = isJson ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return json({ error: 'Could not read the form' }, 400);
  }

  // Honeypot: bots fill every field. Pretend success.
  if (typeof raw.website === 'string' && raw.website.trim()) return isJson ? json({ ok: true }) : Response.redirect(new URL('/demo?sent=1', request.url).toString(), 303);

  const row: Record<string, string | null> = {};
  for (const f of FIELDS) {
    const v = typeof raw[f] === 'string' ? (raw[f] as string).trim() : '';
    row[f] = v ? v.slice(0, MAX[f] ?? 200) : null;
  }
  if (!row.name || !row.firm || !row.firm_type || !row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return json({ error: 'Please fill in your name, a valid work email, your firm and its type' }, 422);
  }
  row.email = row.email.toLowerCase();
  const personalEmail = FREE_MAIL.test(row.email);
  const country = ((request as Request & { cf?: { country?: string } }).cf?.country) ?? null;

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return json({ error: 'Demo requests are not configured yet' }, 503);
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/demo_requests`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({ ...row, personal_email: personalEmail, country }),
  });
  if (!res.ok) return json({ error: 'We could not save your request' }, 502);

  if (env.POSTHOG_KEY) {
    waitUntil(
      fetch(`${env.POSTHOG_HOST || 'https://us.i.posthog.com'}/capture/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: env.POSTHOG_KEY,
          event: 'demo_request_received',
          distinct_id: row.email,
          properties: {
            firm_type: row.firm_type, aum_band: row.aum_band, team_size: row.team_size,
            connector: row.connector, personal_email: personalEmail, country, site: 'landing',
            $set: { email: row.email, name: row.name, firm: row.firm, role: row.role, firm_type: row.firm_type },
          },
        }),
      }).catch(() => undefined),
    );
  }

  return isJson ? json({ ok: true }) : Response.redirect(new URL('/demo?sent=1', request.url).toString(), 303);
};
