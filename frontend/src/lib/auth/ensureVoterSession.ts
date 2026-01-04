/**
 * ensureVoterSession - Guarantees an anonymous Supabase session exists for voting
 * 
 * This function ensures that anonymous visitors have a Supabase session before voting.
 * It silently creates an anonymous session if one doesn't exist, enabling proper
 * RLS and foreign key constraints.
 * 
 * @returns Promise<boolean> - true if session exists or was created, false on error
 */

import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export async function ensureVoterSession(): Promise<boolean> {
  try {
    // Check for existing session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error checking session:', sessionError);
      // Continue to try creating anonymous session
    }
    
    // If we already have a session (authenticated or anonymous), we're good
    if (session?.user) {
      return true;
    }
    
    // No session exists - create anonymous session
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      console.error('Failed to create anonymous session:', error);
      toast.error('Voting temporarily unavailable. Please retry.', { duration: 3000 });
      return false;
    }
    
    if (!data?.user) {
      console.error('Anonymous sign-in succeeded but no user returned');
      toast.error('Voting temporarily unavailable. Please retry.', { duration: 3000 });
      return false;
    }
    
    // Session created successfully
    return true;
  } catch (error) {
    console.error('Unexpected error in ensureVoterSession:', error);
    toast.error('Voting temporarily unavailable. Please retry.', { duration: 3000 });
    return false;
  }
}

