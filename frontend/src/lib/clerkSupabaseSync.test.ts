import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * These cover the one property the Clerk -> Supabase exchange has to have: it runs
 * once, no matter how many hooks ask for it.
 *
 * `useAuth` drives a full sync from every instance, and the app mounts three or four at
 * a time. Because `generateLink` invalidates the previous token for an email and
 * `verifyOtp` is single-use, concurrent exchanges cannot all succeed -- they knock each
 * other out, which is what left users with no Supabase session at all.
 */

const verifyOtp = vi.fn()
const getSession = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      signInWithOtp: vi.fn().mockResolvedValue({ error: { message: 'not used' } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: 'x' }) }) }),
    }),
  },
}))

const clerkUser = {
  id: 'user_clerk_123',
  emailAddresses: [{ emailAddress: 'analyst@example.com' }],
}

const SUPABASE_USER_ID = '11111111-2222-3333-4444-555555555555'

let fetchCalls = 0

function mockEdgeFunction(overrides: Record<string, unknown> = {}) {
  fetchCalls = 0
  vi.stubGlobal('fetch', vi.fn(async () => {
    fetchCalls += 1
    return {
      ok: true,
      json: async () => ({
        success: true,
        supabaseUserId: SUPABASE_USER_ID,
        email: 'analyst@example.com',
        isNewUser: false,
        sessionToken: 'hashed-token-abc',
        magicLink: 'https://x.supabase.co/auth/v1/verify?token=hashed-token-abc&type=magiclink',
        ...overrides,
      }),
    }
  }))
}

beforeEach(() => {
  vi.resetModules()
  verifyOtp.mockReset()
  getSession.mockReset()
  getSession.mockResolvedValue({ data: { session: null } })
  mockEdgeFunction()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('syncClerkUserToSupabase', () => {
  it('performs ONE exchange when four hooks ask at once', async () => {
    verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: SUPABASE_USER_ID } } },
      error: null,
    })
    const { syncClerkUserToSupabase } = await import('./clerkSupabaseSync')

    const results = await Promise.all([
      syncClerkUserToSupabase(clerkUser),
      syncClerkUserToSupabase(clerkUser),
      syncClerkUserToSupabase(clerkUser),
      syncClerkUserToSupabase(clerkUser),
    ])

    // The whole point: one magic link requested, one redemption attempted.
    expect(fetchCalls).toBe(1)
    expect(verifyOtp).toHaveBeenCalledTimes(1)

    // Every caller still gets the session.
    for (const r of results) {
      expect(r?.userId).toBe(SUPABASE_USER_ID)
      expect(r?.session?.access_token).toBe('jwt')
    }
  })

  it('gives every concurrent caller the identical promise result', async () => {
    verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: SUPABASE_USER_ID } } },
      error: null,
    })
    const { syncClerkUserToSupabase } = await import('./clerkSupabaseSync')

    const a = syncClerkUserToSupabase(clerkUser)
    const b = syncClerkUserToSupabase(clerkUser)
    expect(a).toBe(b)
    await a
  })

  it('runs a fresh exchange once the previous one has settled', async () => {
    verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: SUPABASE_USER_ID } } },
      error: null,
    })
    const { syncClerkUserToSupabase } = await import('./clerkSupabaseSync')

    await syncClerkUserToSupabase(clerkUser)
    await syncClerkUserToSupabase(clerkUser)
    // Not cached forever: a later sign-in must be able to exchange again.
    expect(fetchCalls).toBe(2)
  })

  it('does not serve one user the exchange belonging to another', async () => {
    verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'jwt', user: { id: SUPABASE_USER_ID } } },
      error: null,
    })
    const { syncClerkUserToSupabase } = await import('./clerkSupabaseSync')

    const a = syncClerkUserToSupabase(clerkUser)
    const b = syncClerkUserToSupabase({ ...clerkUser, id: 'user_clerk_OTHER' })
    expect(a).not.toBe(b)
    await Promise.all([a, b])
  })

  it('returns null without calling the edge function when there is no Clerk user', async () => {
    const { syncClerkUserToSupabase } = await import('./clerkSupabaseSync')
    await expect(syncClerkUserToSupabase(null)).resolves.toBeNull()
    expect(fetchCalls).toBe(0)
  })
})

describe('getSyncSteps', () => {
  it('records the verifyOtp failure that used to vanish into an empty catch', async () => {
    verifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token has expired or is invalid' },
    })
    const { syncClerkUserToSupabase, getSyncSteps } = await import('./clerkSupabaseSync')

    await syncClerkUserToSupabase(clerkUser)
    const steps = getSyncSteps()

    const verify = steps.find((s) => s.step === 'verifyOtp on the magic-link token')
    expect(verify?.ok).toBe(false)
    expect(verify?.detail).toContain('expired')
  })

  it('records an edge function that answers without a user id', async () => {
    mockEdgeFunction({ success: false, supabaseUserId: null })
    const { syncClerkUserToSupabase, getSyncSteps } = await import('./clerkSupabaseSync')

    await syncClerkUserToSupabase(clerkUser)
    expect(getSyncSteps().some((s) => !s.ok && s.step.includes('edge function'))).toBe(true)
  })

  it('notes when the edge function returns no magic link at all', async () => {
    mockEdgeFunction({ magicLink: null, sessionToken: null })
    const { syncClerkUserToSupabase, getSyncSteps } = await import('./clerkSupabaseSync')

    await syncClerkUserToSupabase(clerkUser)
    const edge = getSyncSteps().find((s) => s.step.includes('edge function'))
    expect(edge?.detail).toContain('ABSENT')
  })
})
