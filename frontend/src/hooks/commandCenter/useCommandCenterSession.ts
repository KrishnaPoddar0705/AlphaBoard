import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useOrganization, type OrgRole } from '@/hooks/useOrganization'

export interface CommandCenterSession {
  /**
   * True once supabase-js holds a REAL access token and the membership row has
   * resolved. Every query and mutation here gates on it.
   */
  ready: boolean
  /** False until we know one way or the other; distinguishes "loading" from "signed out". */
  resolved: boolean
  /**
   * Whether supabase-js can actually authenticate a request.
   *
   * This is deliberately not "is there a session object". `useAuth` falls back to a
   * *compatibility session* -- a session-shaped object carrying the right user id but
   * `access_token: ''` (hooks/useAuth.ts) -- when the Clerk -> Supabase magic-link
   * exchange does not complete. Requests made in that state go out as `anon`, and since
   * this feature revokes anon they fail with a bare
   * `42501 permission denied for table cc_coverage`, which reads like a broken
   * migration rather than a missing token. Checking the token itself is the only
   * honest test.
   */
  authenticated: boolean
  userId: string | null
  organizationId: string | null
  role: OrgRole | null
  /** True for a user with no organization: their rows are private to them. */
  isSolo: boolean
  /** Admins and portfolio managers default to seeing the whole desk's activity. */
  seesWholeDesk: boolean
}

interface AuthState {
  resolved: boolean
  userId: string | null
  hasToken: boolean
}

const UNRESOLVED: AuthState = { resolved: false, userId: null, hasToken: false }

/**
 * Command Center's view of who is signed in.
 *
 * It reads `supabase.auth` directly and does NOT call `useAuth()`, which matters more
 * than it looks: `useAuth` is not a passive reader. Every instance of it runs its own
 * Clerk -> Supabase sync, and that sync consumes a single-use magic-link token via
 * `verifyOtp` and calls `supabase.auth.signOut()` on several paths. Mounting an extra
 * instance therefore makes concurrent instances fight over one token and sign each
 * other out -- the same failure commit c700f58 fixed by collapsing the dashboards onto
 * a single `useOrganization`.
 *
 * `useOrganization` already owns one `useAuth`, so org and role come from there and the
 * session state is observed, never driven.
 */
export function useCommandCenterSession(): CommandCenterSession {
  const { organization, loading: orgLoading } = useOrganization()
  const [auth, setAuth] = useState<AuthState>(UNRESOLVED)

  useEffect(() => {
    let alive = true

    const apply = (session: Session | null) => {
      if (!alive) return
      setAuth({
        resolved: true,
        userId: session?.user?.id ?? null,
        // An empty-string token is the compatibility-session case, and it is not usable.
        hasToken: !!session?.access_token,
      })
    }

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null))

    // The sync completes asynchronously well after first paint, so the subscription --
    // not the initial read -- is what usually flips this to authenticated.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session)
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  return useMemo(() => {
    const resolved = auth.resolved && !orgLoading
    const role = organization?.role ?? null
    return {
      resolved,
      authenticated: auth.hasToken,
      ready: resolved && auth.hasToken,
      userId: auth.userId,
      organizationId: organization?.id ?? null,
      role,
      isSolo: resolved && !organization,
      seesWholeDesk: role === 'admin' || role === 'portfolio_manager',
    }
  }, [auth, organization, orgLoading])
}
