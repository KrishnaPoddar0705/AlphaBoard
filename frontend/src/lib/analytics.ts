import posthog from 'posthog-js'

/**
 * Product analytics (PostHog): pageviews, autocapture, session replay, error tracking
 * and the handful of named events below.
 *
 * The project token is a write-only public key -- it is meant to ship in the bundle, like
 * the Supabase anon key. It can only send events; it cannot read anything back.
 *
 * Nothing is sent from `npm run dev` unless VITE_POSTHOG_DEV=true, so local clicking
 * around does not pollute the numbers.
 */
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

const enabled = !!KEY && (import.meta.env.PROD || import.meta.env.VITE_POSTHOG_DEV === 'true')

export function initAnalytics(): void {
  if (!enabled || posthog.__loaded) return
  posthog.init(KEY!, {
    api_host: HOST,
    ui_host: 'https://us.posthog.com',
    // Dated defaults: SPA pageviews on history change, pageleave, and so on.
    defaults: '2025-11-30',
    // Anonymous visitors (public leaderboard, shared stock pages) are counted but get
    // no person profile until they sign in.
    person_profiles: 'identified_only',
    capture_exceptions: true,
    session_recording: {
      // Research notes, questions and prices typed into forms never leave the browser.
      maskAllInputs: true,
    },
  })
}

interface Identity {
  /** The Supabase user id -- the same id every table uses, so events join to app data. */
  userId: string
  email?: string | null
  name?: string | null
  clerkId?: string | null
}

export function identifyUser({ userId, email, name, clerkId }: Identity): void {
  if (!enabled) return
  posthog.identify(userId, {
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(clerkId ? { clerk_id: clerkId } : {}),
  })
}

/** Ties the person to their organization, so usage can be read per desk as well as per user. */
export function setOrganization(org: { id: string; name: string; role: string } | null): void {
  if (!enabled) return
  if (!org) {
    posthog.setPersonProperties({ organization_id: null, organization_name: null, org_role: null })
    return
  }
  posthog.group('organization', org.id, { name: org.name })
  posthog.setPersonProperties({
    organization_id: org.id, organization_name: org.name, org_role: org.role,
  })
}

export function resetAnalytics(): void {
  if (!enabled) return
  posthog.reset()
}

/**
 * The named events. Autocapture already records every click and pageview; these exist
 * for the actions worth counting by name. Properties are categories and flags only --
 * never the text an analyst wrote.
 */
export interface AnalyticsEvents {
  cc_entry_logged: {
    kind: string
    subtype: string | null
    is_scheduled: boolean
    thesis_impact: string | null
    svan_rating: string | null
    has_svan_view: boolean
    has_takeaways: boolean
    attachment_count: number
    contact_count: number
    pushed_to_pm: boolean
    pushed_to_admin: boolean
  }
  cc_entry_pushed: { to_pm: boolean; to_admin: boolean }
  cc_entry_deleted: Record<string, never>
  cc_comment_added: Record<string, never>
  cc_coverage_added: { ticker: string; sector: string }
  cc_coverage_archived: Record<string, never>
  cc_matrix_viewed: { grouping: string }
  cc_matrix_cell_opened: { column: string }
  /** Demand signal for the not-yet-built data enrichment. */
  cc_matrix_enrich_clicked: Record<string, never>
}

export function track<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E]): void {
  if (!enabled) return
  posthog.capture(event, properties)
}
