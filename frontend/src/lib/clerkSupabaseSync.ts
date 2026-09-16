/**
 * Clerk-Supabase Sync Helper
 * Syncs Clerk user authentication with Supabase and manages Supabase sessions
 */

import { supabase } from './supabase';

/**
 * Why the last Clerk -> Supabase exchange ended where it did.
 *
 * Every failure path below used to be an empty `catch {}`, so a user with no Supabase
 * session had no way to find out why -- and neither did anyone helping them. The steps
 * are recorded here and surfaced by the Command Center diagnostics panel.
 */
export interface SyncStep {
  step: string
  ok: boolean
  detail?: string
}

let syncSteps: SyncStep[] = [];
const note = (step: string, ok: boolean, detail?: unknown) => {
  syncSteps.push({
    step,
    ok,
    detail: detail === undefined ? undefined
      : detail instanceof Error ? detail.message
      : typeof detail === 'string' ? detail
      : JSON.stringify(detail)?.slice(0, 200),
  });
};

export function getSyncSteps(): SyncStep[] {
  return syncSteps;
}

const getEdgeFunctionUrl = () => {
  // Local override, for running an edge function against the real database without
  // deploying it. Set VITE_EDGE_FUNCTIONS_URL in frontend/.env and point it at a
  // locally served function; leave it unset and nothing changes. See
  // frontend/.env.example for how to serve one.
  const override = import.meta.env.VITE_EDGE_FUNCTIONS_URL;
  if (override) return String(override).replace(/\/$/, '');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

  if (supabaseUrl) {
    const baseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    return `${baseUrl}/functions/v1`;
  }

  return 'http://localhost:54321/functions/v1';
};

const EDGE_FUNCTION_URL = getEdgeFunctionUrl();

interface ClerkUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface SyncResponse {
  success: boolean;
  supabaseUserId: string;
  email: string;
  isNewUser: boolean;
  sessionToken?: string | null;
  magicLink?: string | null;
}


type SyncResult = { session: any; userId: string } | null;

let inFlight: { key: string; promise: Promise<SyncResult> } | null = null;

/**
 * Runs the Clerk -> Supabase exchange at most once at a time, per user.
 *
 * This is the fix for "no Supabase session". `useAuth` is not a passive reader -- every
 * instance of it drives a full sync, and the app mounts three or four at once
 * (useOrganization, AppSidebar, PaperPortfolioContext, and whatever page is open). Each
 * instance was independently asking the edge function for a magic link and redeeming it
 * with `verifyOtp`.
 *
 * That cannot work more than once by construction:
 *   - `generateLink` for an email invalidates the token it issued previously, so the
 *     first instance's token is dead by the time it redeems it;
 *   - `verifyOtp` is single-use, so only one redemption of a given token can win;
 *   - Supabase rate-limits both, so the later calls start failing outright;
 *   - and `useAuth` calls `supabase.auth.signOut()` on several paths, so an instance
 *     that loses the race can destroy the session an instance that won just created.
 *
 * Sharing one in-flight promise turns N races into one exchange, which is the only
 * number that can succeed. Callers still each get the result.
 */
export function syncClerkUserToSupabase(clerkUser: ClerkUser | null): Promise<SyncResult> {
  if (!clerkUser) return Promise.resolve(null);

  // Keyed by Clerk user so switching accounts is never served a stale exchange.
  if (inFlight && inFlight.key === clerkUser.id) return inFlight.promise;

  syncSteps = [];
  const promise = performSync(clerkUser).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { key: clerkUser.id, promise };
  return promise;
}

/**
 * Sync Clerk user with Supabase and get/create Supabase session
 * @param clerkUser - Clerk user object from useUser() hook
 * @returns Supabase session or null if sync failed
 */
async function performSync(clerkUser: ClerkUser): Promise<{ session: any; userId: string } | null> {

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return null;
  }

  try {
    // Call sync Edge Function
    // Note: Edge Functions require Authorization header even if function doesn't use it
    // We use the anon key as Bearer token for the header
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const syncUrl = `${EDGE_FUNCTION_URL}/sync-clerk-user`;
    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        clerkUser: {
          clerkUserId: clerkUser.id,
          email,
          username: clerkUser.username || undefined,
          firstName: clerkUser.firstName || undefined,
          lastName: clerkUser.lastName || undefined,
        },
      }),
    });

    if (!syncResponse.ok) {
      const body = await syncResponse.json().catch(() => null);
      note('sync-clerk-user edge function', false, `HTTP ${syncResponse.status} ${JSON.stringify(body)}`);
      return null;
    }

    const syncData: SyncResponse = await syncResponse.json();

    if (!syncData.success || !syncData.supabaseUserId) {
      note('sync-clerk-user edge function', false, 'responded without a supabaseUserId');
      return null;
    }
    note('sync-clerk-user edge function', true,
      `user ${syncData.supabaseUserId.slice(0, 8)}..., magicLink ${syncData.magicLink ? 'present' : 'ABSENT'}`);

    // Now we need to create a Supabase session for this user
    // Check if we already have a valid session
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    
    if (existingSession && existingSession.user.id === syncData.supabaseUserId) {
      // Already have a valid session for this user
      note('reuse existing Supabase session', true);
      return { session: existingSession, userId: syncData.supabaseUserId };
    }

    // Use session token from sync response to create session immediately
    if (syncData.magicLink) {
      try {
        // Extract token from magic link URL
        // Magic link format: https://.../#access_token=...&token=...&type=...
        const url = new URL(syncData.magicLink);
        let token = syncData.sessionToken || null;
        
        // Try to extract from hash
        if (url.hash) {
          const hashParams = new URLSearchParams(url.hash.substring(1));
          token = hashParams.get('token') || hashParams.get('access_token') || token;
        }
        
        // Try to extract from query params
        if (!token) {
          token = url.searchParams.get('token') || url.searchParams.get('access_token');
        }
        
        // Use verifyOtp to create session from the token
        if (token) {
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink',
          });

          if (!verifyError && verifyData.session) {
            // Session created successfully
            note('verifyOtp on the magic-link token', true);
            return { session: verifyData.session, userId: syncData.supabaseUserId };
          } else {
            note('verifyOtp on the magic-link token', false,
              verifyError?.message ?? 'returned no session');
          }
        }
        
        // If we have a magic link but token extraction failed, try using signInWithOtp
        // This will send a new magic link, but it's more reliable
        if (syncData.magicLink && !token) {
          note('extract token from magic link', false, 'no token in the action_link');
        }
      } catch (err) {
        note('extract token from magic link', false, err);
      }
    }

    // Fallback: Use passwordless OTP (magic link) to create a session
    // This will send an email, but it's the most reliable method
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: syncData.email,
        options: {
          shouldCreateUser: false, // User already exists
          emailRedirectTo: window.location.origin,
        },
      });

      if (otpError) {
        note('signInWithOtp fallback', false, otpError.message);
        // Return user ID - session will be created when user verifies email
        return { session: null, userId: syncData.supabaseUserId };
      }

      // Wait a moment and check if session was created
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: { session: newSession } } = await supabase.auth.getSession();
      
      if (newSession && newSession.user.id === syncData.supabaseUserId) {
        return { session: newSession, userId: syncData.supabaseUserId };
      }
    } catch (err) {
    }

    // If we still don't have a session, try using the magic link directly
    if (syncData.magicLink) {
      try {
        // Try to extract and use the token from the magic link
        const url = new URL(syncData.magicLink);
        const token = url.hash.split('token=')[1]?.split('&')[0];
        
        if (token) {
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink',
          });

          if (!verifyError && verifyData.session) {
            return { session: verifyData.session, userId: syncData.supabaseUserId };
          }
        }
      } catch (err) {
      }
    }

    // Last resort: Return user ID - the useAuth hook will handle retrying
    note('overall', false, 'no Supabase session could be created');
    return { session: null, userId: syncData.supabaseUserId };
  } catch (error) {
    note('overall', false, error);
    return null;
  }
}

/**
 * Get Supabase user ID for a Clerk user ID
 * @param clerkUserId - Clerk user ID
 * @returns Supabase user ID or null
 */
export async function getSupabaseUserIdForClerkUser(clerkUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('clerk_user_mapping')
      .select('supabase_user_id')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.supabase_user_id;
  } catch (error) {
    return null;
  }
}

