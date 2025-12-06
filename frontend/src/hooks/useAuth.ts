import { useEffect, useState, useMemo, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { syncClerkUserToSupabase, getSupabaseUserIdForClerkUser } from '../lib/clerkSupabaseSync';

/**
 * Custom auth hook that uses Clerk for authentication and syncs with Supabase
 * Returns a session-like object for backward compatibility with existing code
 */
export function useAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!clerkLoaded) {
      setLoading(true);
      return;
    }

    if (!clerkUser) {
      // No Clerk user, clear Supabase session
      setSupabaseSession(null);
      setSupabaseUserId(null);
      setLoading(false);
      hasSyncedRef.current = false;
      return;
    }

    // Only sync once per Clerk user
    if (hasSyncedRef.current && syncingRef.current) {
      return;
    }

    // Sync Clerk user with Supabase
    const syncUser = async () => {
      if (syncingRef.current) return; // Prevent multiple syncs
      
      syncingRef.current = true;
      hasSyncedRef.current = true;
      
      try {
        // First, check if we already have a valid Supabase session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession && existingSession.user) {
          // Verify session is still valid
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          if (supabaseUser && supabaseUser.id === existingSession.user.id) {
            setSupabaseSession(existingSession);
            setSupabaseUserId(existingSession.user.id);
            setLoading(false);
            syncingRef.current = false;
            return;
          }
        }

        // Sync Clerk user to Supabase
        const syncResult = await syncClerkUserToSupabase(clerkUser);
        
        if (syncResult) {
          // Set Supabase user ID from sync result
          if (syncResult.userId) {
            setSupabaseUserId(syncResult.userId);
          }
          
          // Get the Supabase session
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            setSupabaseSession(session);
            setSupabaseUserId(session.user.id);
          } else if (syncResult.userId) {
            // Session not available yet, but we have the Supabase user ID
            // Try to get user info to create a compatibility session
            const { data: { user: supabaseUser } } = await supabase.auth.getUser();
            if (supabaseUser && supabaseUser.id === syncResult.userId) {
              setSupabaseSession({
                access_token: '', // Will be filled when session is available
                refresh_token: '',
                expires_in: 3600,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                token_type: 'bearer',
                user: supabaseUser,
              } as Session);
              setSupabaseUserId(supabaseUser.id);
            }
          }
        } else {
          // Sync failed, try to get Supabase user ID from mapping table
          const mappedUserId = await getSupabaseUserIdForClerkUser(clerkUser.id);
          if (mappedUserId) {
            setSupabaseUserId(mappedUserId);
          }
          console.warn('Failed to sync Clerk user with Supabase');
        }
      } catch (error) {
        console.error('Error syncing Clerk user:', error);
      } finally {
        setLoading(false);
        syncingRef.current = false;
      }
    };

    syncUser();
  }, [clerkUser?.id, clerkLoaded]); // Only depend on clerkUser.id, not the whole object

  // Listen for Supabase auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        setSupabaseSession(session);
        setSupabaseUserId(session.user.id);
      } else {
        setSupabaseSession(null);
        setSupabaseUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Memoize the compatibility session to prevent unnecessary re-renders
  const compatibilitySession = useMemo(() => {
    if (supabaseSession) {
      return null; // We have a real session, don't create compatibility one
    }
    
    if (!clerkUser || !supabaseUserId) {
      return null;
    }

    return {
      access_token: '', // Will be populated when Supabase session is available
      refresh_token: '',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer' as const,
      user: {
        id: supabaseUserId, // Use Supabase UUID, not Clerk ID
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        aud: 'authenticated' as const,
        role: 'authenticated' as const,
        email_confirmed_at: clerkUser.emailAddresses[0]?.verification?.status === 'verified' ? new Date().toISOString() : null,
        phone: clerkUser.primaryPhoneNumber?.phoneNumber || '',
        confirmed_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : null,
        last_sign_in_at: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt).toISOString() : null,
        app_metadata: {},
        user_metadata: {
          username: clerkUser.username || clerkUser.firstName || '',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
        },
        identities: [],
        created_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString(),
        updated_at: clerkUser.updatedAt ? new Date(clerkUser.updatedAt).toISOString() : new Date().toISOString(),
      },
    } as Session;
  }, [clerkUser, supabaseUserId, supabaseSession]);

  // Use real session if available, otherwise use compatibility session
  // Memoize to prevent unnecessary re-renders
  const session: Session | null = useMemo(() => {
    return supabaseSession || compatibilitySession;
  }, [supabaseSession, compatibilitySession]);

  return { session, loading: loading || !clerkLoaded };
}

