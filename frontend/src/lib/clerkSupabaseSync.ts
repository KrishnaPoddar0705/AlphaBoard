/**
 * Clerk-Supabase Sync Helper
 * Syncs Clerk user authentication with Supabase and manages Supabase sessions
 */

import { supabase } from './supabase';

const getEdgeFunctionUrl = () => {
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

/**
 * Sync Clerk user with Supabase and get/create Supabase session
 * @param clerkUser - Clerk user object from useUser() hook
 * @returns Supabase session or null if sync failed
 */
export async function syncClerkUserToSupabase(clerkUser: ClerkUser | null): Promise<{ session: any; userId: string } | null> {
  if (!clerkUser) {
    return null;
  }

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
      await syncResponse.json();
      return null;
    }

    const syncData: SyncResponse = await syncResponse.json();

    if (!syncData.success || !syncData.supabaseUserId) {
      return null;
    }

    // Now we need to create a Supabase session for this user
    // Check if we already have a valid session
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    
    if (existingSession && existingSession.user.id === syncData.supabaseUserId) {
      // Already have a valid session for this user
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
            return { session: verifyData.session, userId: syncData.supabaseUserId };
          } else {
          }
        }
        
        // If we have a magic link but token extraction failed, try using signInWithOtp
        // This will send a new magic link, but it's more reliable
        if (syncData.magicLink && !token) {
        }
      } catch (err) {
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
    return { session: null, userId: syncData.supabaseUserId };
  } catch (error) {
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

