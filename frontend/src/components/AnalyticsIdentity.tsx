import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '@/lib/supabase'
import { identifyUser, resetAnalytics, setOrganization } from '@/lib/analytics'

/**
 * Tells analytics who is signed in. Renders nothing.
 *
 * Deliberately does not call useAuth(): every instance of that hook runs its own
 * Clerk -> Supabase sync. This only listens for the session that sync produces, so it
 * adds no requests beyond one membership lookup per sign-in.
 */
export default function AnalyticsIdentity() {
  const { user, isLoaded } = useUser()
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)
  const identified = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSupabaseUserId(data.session?.user.id ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUserId(session?.user.id ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      // Signed out: stop attributing this browser's events to the last person.
      if (identified.current) {
        resetAnalytics()
        identified.current = null
      }
      return
    }

    if (!supabaseUserId || identified.current === supabaseUserId) return
    identified.current = supabaseUserId

    identifyUser({
      userId: supabaseUserId,
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName || user.username,
      clerkId: user.id,
    })

    let cancelled = false
    supabase
      .from('user_organization_membership')
      .select('organization_id, role, organizations(name)')
      .eq('user_id', supabaseUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const org = data?.organizations as { name?: string } | { name?: string }[] | null | undefined
        const name = (Array.isArray(org) ? org[0]?.name : org?.name) ?? 'Unknown'
        setOrganization(data ? { id: data.organization_id, name, role: data.role } : null)
      })
    return () => { cancelled = true }
  }, [isLoaded, user, supabaseUserId])

  return null
}
