import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { CheckCircle2, Loader2, RefreshCw, XCircle, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { searchStocks } from '@/lib/api'
import { useOrganization } from '@/hooks/useOrganization'
import { getSyncSteps, syncClerkUserToSupabase } from '@/lib/clerkSupabaseSync'

type Status = 'pass' | 'fail' | 'warn' | 'pending'

interface Check {
  id: string
  label: string
  status: Status
  detail: string
  /** What to do about it. Only shown when the check is not passing. */
  fix?: string
}

const ICON: Record<Status, typeof CheckCircle2> = {
  pass: CheckCircle2,
  fail: XCircle,
  warn: MinusCircle,
  pending: Loader2,
}

/**
 * What to do about each step of the Clerk -> Supabase exchange when it fails. Keyed by
 * the step names recorded in lib/clerkSupabaseSync.ts.
 */
const EXCHANGE_FIXES: Record<string, string> = {
  'sync-clerk-user edge function':
    'The edge function is rejecting the request or cannot mint a link. Check its logs in the Supabase dashboard (Edge Functions -> sync-clerk-user), and that SUPABASE_SERVICE_ROLE_KEY is set on it.',
  'verifyOtp on the magic-link token':
    'The magic-link token was refused. Most often: the Email provider is disabled in Supabase (Authentication -> Providers -> Email), the token expired, or auth rate limits were hit. Enable the Email provider -- generateLink and verifyOtp both require it even though no mail is sent.',
  'extract token from magic link':
    'The edge function returned an action_link this client could not parse. Check what sync-clerk-user is returning for magicLink.',
  'signInWithOtp fallback':
    'The fallback also failed, which again points at the Email provider being disabled or rate limited.',
}

/**
 * The "Email already registered" case, which is not a bug so much as a broken link.
 *
 * clerk_user_mapping is keyed on clerk_user_id. If you sign in with a NEW Clerk account
 * that has the same email as an old one -- a re-registration, or a second Clerk
 * instance -- the lookup by your current id finds nothing, the function then finds the
 * old row by email, sees a different owner, and refuses. Your Supabase user and all its
 * data are intact; only the row pointing at them names the wrong Clerk account.
 *
 * The repair is deliberately manual: re-pointing a mapping on email alone would let
 * anyone who signs up with an address take over the account already using it.
 */
function emailConflictFix(detail: string | undefined, clerkUserId: string | undefined): string | undefined {
  if (!detail || !/email already registered/i.test(detail)) return undefined
  const id = clerkUserId ?? '<your clerk_user_id, shown above>'
  return (
    'Your Supabase account is mapped to a DIFFERENT Clerk user with this same email, ' +
    'so the exchange refuses to hand it over. Confirm the old owner, then re-point it:\n\n' +
    "  select clerk_user_id, supabase_user_id, email from public.clerk_user_mapping\n" +
    "   where lower(email) = lower('<your email>');\n\n" +
    `  update public.clerk_user_mapping\n` +
    `     set clerk_user_id = '${id}'\n` +
    `   where lower(email) = lower('<your email>');\n\n` +
    'Only do this if both Clerk accounts are yours. It reconnects your existing ' +
    'Supabase user -- and all its data -- to the account you are signed in with now.'
  )
}

const COLOR: Record<Status, string> = {
  pass: '#2F8F5B',
  fail: '#B23B2A',
  warn: '#D06030',
  pending: '#8B857A',
}

/**
 * Answers "why is Command Center not working" without a round trip.
 *
 * Four different faults present identically in the UI -- an empty board or a bare
 * "permission denied" -- and they have four different fixes: no Clerk user, a Clerk
 * user with no Supabase token, a migration that was not applied, and a backend the dev
 * server cannot reach. Each row below separates one of them and says what to do.
 *
 * Development only: it reports auth and schema state, which is not something to render
 * for real users.
 */
export default function DevDiagnostics() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { organization, loading: orgLoading } = useOrganization()
  const [checks, setChecks] = useState<Check[]>([])
  const [running, setRunning] = useState(false)

  /**
   * Gathers every check and returns them. Pure with respect to React state on purpose:
   * the effect below calls this and updates state only in the resolved callback, which
   * is what keeps it out of "setState synchronously inside an effect".
   */
  const collect = useCallback(async (): Promise<Check[]> => {
    const results: Check[] = []

    // 1. Clerk
    results.push(
      clerkLoaded && clerkUser
        ? { id: 'clerk', label: 'Clerk session', status: 'pass',
            detail: `${clerkUser.primaryEmailAddress?.emailAddress ?? '(no email)'} -- clerk_user_id ${clerkUser.id}` }
        : { id: 'clerk', label: 'Clerk session', status: 'fail',
            detail: clerkLoaded ? 'no Clerk user' : 'Clerk still loading',
            fix: 'Sign in. Everything below depends on this.' }
    )

    // 2. Supabase token -- the check that matters most, because a session-shaped object
    //    with an empty token looks signed in and behaves as anon.
    let hasToken = false
    try {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      hasToken = !!session?.access_token
      results.push(
        hasToken
          ? { id: 'supabase', label: 'Supabase access token', status: 'pass',
              detail: `user ${session!.user.id.slice(0, 8)}..., expires ${
                session!.expires_at ? new Date(session!.expires_at * 1000).toLocaleTimeString() : 'unknown'}` }
          : { id: 'supabase', label: 'Supabase access token', status: 'fail',
              detail: session
                ? 'session present but access_token is empty (useAuth compatibility session)'
                : 'no Supabase session',
              fix: 'Requests go out as anon and every cc_ table will refuse them. Reload; if it persists, sign out and back in so the Clerk to Supabase exchange reruns.' }
      )
    } catch (err) {
      results.push({ id: 'supabase', label: 'Supabase access token', status: 'fail',
        detail: err instanceof Error ? err.message : 'failed to read session' })
    }

    // 2b. If there is no token, say which step of the exchange failed. These come from
    //     lib/clerkSupabaseSync.ts, whose failure paths used to be empty catch blocks.
    if (!hasToken) {
      const steps = getSyncSteps()
      if (steps.length === 0) {
        results.push({ id: 'exchange', label: 'Clerk to Supabase exchange', status: 'warn',
          detail: 'has not run yet on this page load',
          fix: 'Press "Retry Supabase sign-in" below to run it and capture the reason.' })
      } else {
        for (const [i, step] of steps.entries()) {
          results.push({
            id: `exchange-${i}`,
            label: `Exchange: ${step.step}`,
            status: step.ok ? 'pass' : 'fail',
            detail: step.detail ?? (step.ok ? 'ok' : 'failed'),
            fix: step.ok
              ? undefined
              : emailConflictFix(step.detail, clerkUser?.id) ?? EXCHANGE_FIXES[step.step],
          })
        }
      }
    }

    // 3. Organization
    results.push(
      orgLoading
        ? { id: 'org', label: 'Organization', status: 'pending', detail: 'still resolving' }
        : organization
          ? { id: 'org', label: 'Organization', status: 'pass',
              detail: `${organization.name} (${organization.role})` }
          : { id: 'org', label: 'Organization', status: 'warn',
              detail: 'no membership row -- coverage will be private to you',
              fix: 'Expected for a solo account. Join an organization to share coverage with a desk.' }
    )

    // 4. Schema + grants. Distinguishes "migration missing" from "no token", which is
    //    the pair that has caused the most confusion.
    try {
      const { error } = await supabase.from('cc_coverage').select('id').limit(1)
      if (!error) {
        results.push({ id: 'schema', label: 'cc_coverage readable', status: 'pass',
          detail: 'grants and RLS both satisfied' })
      } else if (error.code === 'PGRST205' || /schema cache/i.test(error.message)) {
        results.push({ id: 'schema', label: 'cc_coverage readable', status: 'fail',
          detail: error.message,
          fix: 'The migration has not been applied. Run database/migration_add_command_center.sql in the Supabase SQL editor.' })
      } else if (error.code === '42501' || /permission denied/i.test(error.message)) {
        results.push({ id: 'schema', label: 'cc_coverage readable', status: 'fail',
          detail: error.message,
          fix: hasToken
            ? 'You have a token, so this is a GRANT problem: re-run the migration and make sure it reaches section 4b (TABLE GRANTS).'
            : 'Caused by the missing access token above, not by the database. Fix that first.' })
      } else {
        results.push({ id: 'schema', label: 'cc_coverage readable', status: 'fail',
          detail: `${error.code ?? ''} ${error.message}`.trim() })
      }
    } catch (err) {
      results.push({ id: 'schema', label: 'cc_coverage readable', status: 'fail',
        detail: err instanceof Error ? err.message : 'query threw' })
    }

    // 5. Seeded brokers -- proves the migration ran past its seed, not just its tables.
    try {
      const { data, error } = await supabase.from('cc_brokers').select('id')
      results.push(
        error
          ? { id: 'brokers', label: 'Seeded brokers', status: 'fail', detail: error.message }
          : (data?.length ?? 0) >= 7
            ? { id: 'brokers', label: 'Seeded brokers', status: 'pass', detail: `${data!.length} visible` }
            : { id: 'brokers', label: 'Seeded brokers', status: 'warn',
                detail: `${data?.length ?? 0} visible, expected at least 7`,
                fix: 'The migration stopped before section 6 (broker seed). Re-run it.' }
      )
    } catch (err) {
      results.push({ id: 'brokers', label: 'Seeded brokers', status: 'fail',
        detail: err instanceof Error ? err.message : 'query threw' })
    }

    // 6. Backend reachability through the dev proxy, and whether search is real or the
    //    synthesized fallback in market.py.
    try {
      const hits = await searchStocks('reliance')
      const synthetic = Array.isArray(hits) && hits.length === 3 &&
        hits.every((h: { name?: string }) => /\((NSE|BSE|US)\)$/.test(h?.name ?? ''))
      results.push(
        synthetic
          ? { id: 'search', label: 'Stock search', status: 'warn',
              detail: 'backend reachable, but returning synthesized tickers',
              fix: 'Yahoo is rate-limiting and Finnhub is not configured on the backend. Set FINNHUB_API_KEY on the backend, or search results will be invented (APPLE.NS and similar).' }
          : { id: 'search', label: 'Stock search', status: 'pass',
              detail: `${Array.isArray(hits) ? hits.length : 0} real results` }
      )
    } catch (err) {
      results.push({ id: 'search', label: 'Stock search', status: 'fail',
        detail: err instanceof Error ? err.message : 'request failed',
        fix: 'The dev server proxies /market to DEV_API_PROXY_TARGET (see frontend/.env.example). Restart npm run dev after changing it.' })
    }

    return results
  }, [clerkLoaded, clerkUser, organization, orgLoading])

  useEffect(() => {
    let alive = true
    collect().then((results) => { if (alive) setChecks(results) })
    return () => { alive = false }
  }, [collect])

  const rerun = async () => {
    setRunning(true)
    try {
      setChecks(await collect())
    } finally {
      setRunning(false)
    }
  }

  /** Forces one exchange and re-reads the result, so its steps are captured. */
  const retrySignIn = async () => {
    setRunning(true)
    try {
      await syncClerkUserToSupabase(
        clerkUser
          ? {
              id: clerkUser.id,
              emailAddresses: clerkUser.emailAddresses.map((e) => ({
                emailAddress: e.emailAddress,
              })),
              username: clerkUser.username,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
            }
          : null
      )
      setChecks(await collect())
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="rounded-xl border border-[#D7D0C2] bg-[#F7F2E6]">
      <header className="flex items-center justify-between gap-2 border-b border-[#E3DDCF] px-4 py-2.5">
        <div>
          <h2 className="font-mono text-xs text-[#1C1B17]">Command Center diagnostics</h2>
          <p className="font-mono text-[10px] text-[#8B857A]">Development build only.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={retrySignIn} disabled={running}>
            Retry Supabase sign-in
          </Button>
          <Button variant="outline" size="sm" onClick={rerun} disabled={running}>
            <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            Re-run
          </Button>
        </div>
      </header>

      <ul className="divide-y divide-[#E3DDCF]">
        {checks.map((c) => {
          const Icon = ICON[c.status]
          return (
            <li key={c.id} className="flex items-start gap-2.5 px-4 py-2.5">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${c.status === 'pending' ? 'animate-spin' : ''}`}
                style={{ color: COLOR[c.status] }}
              />
              <div className="min-w-0">
                <p className="font-mono text-xs text-[#1C1B17]">{c.label}</p>
                <p className="font-mono text-[11px] break-words text-[#6F6A60]">{c.detail}</p>
                {c.fix && c.status !== 'pass' && (
                  <p className="mt-1 whitespace-pre-wrap font-mono text-[11px]"
                     style={{ color: COLOR[c.status] }}>
                    {c.fix}
                  </p>
                )}
              </div>
            </li>
          )
        })}
        {checks.length === 0 && (
          <li className="px-4 py-6 text-center font-mono text-xs text-[#6F6A60]">Running checks...</li>
        )}
      </ul>
    </section>
  )
}
