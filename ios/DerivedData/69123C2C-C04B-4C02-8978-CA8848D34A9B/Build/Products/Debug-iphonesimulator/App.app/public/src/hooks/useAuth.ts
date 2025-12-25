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
  const lastClerkUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!clerkLoaded) {
      setLoading(true);
      return;
    }

    if (!clerkUser) {
      // No Clerk user, clear Supabase session and reset sync flags
      setSupabaseSession(null);
      setSupabaseUserId(null);
      setLoading(false);
      hasSyncedRef.current = false;
      syncingRef.current = false;
      lastClerkUserIdRef.current = null;
      // Clear Supabase session
      supabase.auth.signOut().catch(err => console.warn('Error clearing session:', err));
      // Clear Supabase auth data from localStorage
      const supabaseKeys = Object.keys(localStorage).filter(key => 
        key.includes('supabase') || key.includes('sb-') || key.startsWith('sb_')
      );
      supabaseKeys.forEach(key => localStorage.removeItem(key));
      return;
    }

    // Check if Clerk user has changed
    const currentClerkUserId = clerkUser.id;
    if (lastClerkUserIdRef.current && lastClerkUserIdRef.current !== currentClerkUserId) {
      // User changed - clear everything and reset sync flags
      console.log('Clerk user changed, clearing previous session');
      setSupabaseSession(null);
      setSupabaseUserId(null);
      hasSyncedRef.current = false;
      syncingRef.current = false;
      // Clear Supabase session
      supabase.auth.signOut().catch(err => console.warn('Error clearing session:', err));
      // Clear Supabase auth data from localStorage
      const supabaseKeys = Object.keys(localStorage).filter(key => 
        key.includes('supabase') || key.includes('sb-') || key.startsWith('sb_')
      );
      supabaseKeys.forEach(key => localStorage.removeItem(key));
    }
    
    lastClerkUserIdRef.current = currentClerkUserId;

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
        // BUT verify it matches the current Clerk user
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession && existingSession.user) {
          // Verify session is still valid AND matches current Clerk user
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          if (supabaseUser && supabaseUser.id === existingSession.user.id) {
            // Check if this Supabase user matches the current Clerk user
            // Use getSupabaseUserIdForClerkUser helper to verify mapping
            const mappedUserId = await getSupabaseUserIdForClerkUser(clerkUser.id);
            
            // If mapping exists and matches current session user, use the session
            if (mappedUserId && mappedUserId === supabaseUser.id) {
              setSupabaseSession(existingSession);
              setSupabaseUserId(existingSession.user.id);
              setLoading(false);
              syncingRef.current = false;
              return;
            } else {
              // Session exists but doesn't match current Clerk user - clear it
              console.log('Supabase session does not match current Clerk user, clearing...');
              await supabase.auth.signOut();
              // Clear Supabase auth data from localStorage
              const supabaseKeys = Object.keys(localStorage).filter(key => 
                key.includes('supabase') || key.includes('sb-') || key.startsWith('sb_')
              );
              supabaseKeys.forEach(key => localStorage.removeItem(key));
              // Clear state
              setSupabaseSession(null);
              setSupabaseUserId(null);
            }
          }
        }

        // Sync Clerk user to Supabase
        const syncResult = await syncClerkUserToSupabase(clerkUser);
        
        if (syncResult) {
          // Set Supabase user ID from sync result
          if (syncResult.userId) {
            setSupabaseUserId(syncResult.userId);
          }
          
          // If we got a session from sync, use it immediately
          if (syncResult.session && syncResult.session.access_token) {
            setSupabaseSession(syncResult.session);
            setSupabaseUserId(syncResult.session.user.id);
            setLoading(false);
            syncingRef.current = false;
            return;
          }
          
          // Wait for session to be created (with retries)
          let retries = 0;
          const maxRetries = 10;
          const retryDelay = 500; // 500ms between retries
          
          while (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user && session.access_token) {
              // Verify it's the right user
              if (syncResult.userId && session.user.id === syncResult.userId) {
                setSupabaseSession(session);
                setSupabaseUserId(session.user.id);
                setLoading(false);
                syncingRef.current = false;
                return;
              }
            }
            
            retries++;
          }
          
          // If we still don't have a session but have a user ID, create compatibility session
          if (syncResult.userId) {
            const { data: { user: supabaseUser } } = await supabase.auth.getUser();
            if (supabaseUser && supabaseUser.id === syncResult.userId) {
              // Still try to get a real session
              const { data: { session: finalSession } } = await supabase.auth.getSession();
              if (finalSession && finalSession.access_token) {
                setSupabaseSession(finalSession);
                setSupabaseUserId(finalSession.user.id);
              } else {
                // Only use compatibility session as last resort
                console.warn('Using compatibility session - real session not available');
                setSupabaseUserId(supabaseUser.id);
              }
            }
          }
        } else {
          // Sync failed, try to get Supabase user ID from mapping table
          const mappedUserId = await getSupabaseUserIdForClerkUser(clerkUser.id);
          if (mappedUserId) {
            setSupabaseUserId(mappedUserId);
            // Try one more time to get session
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user && session.access_token) {
              setSupabaseSession(session);
            }
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
  
  // Reset sync when Clerk user changes
  useEffect(() => {
    if (clerkUser?.id !== lastClerkUserIdRef.current) {
      hasSyncedRef.current = false;
      syncingRef.current = false;
    }
  }, [clerkUser?.id]);

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

