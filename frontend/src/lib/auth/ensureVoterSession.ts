/**
 * ensureVoterSession - Guarantees an anonymous Supabase session exists for voting
 * 
 * This function ensures that anonymous visitors have a Supabase session before voting.
 * It silently creates an anonymous session if one doesn't exist, enabling proper
 * RLS and foreign key constraints.
 * 
 * IMPORTANT: Anonymous sign-ins must be enabled in Supabase Dashboard:
 * Authentication > Providers > Anonymous > Enable
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
      // Continue to try creating anonymous session
    }
    
    // If we already have a session (authenticated or anonymous), we're good
    if (session?.user) {
      return true;
    }
    
    // No session exists - create anonymous session
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      // Handle specific error: anonymous provider disabled
      if (error.message?.includes('anonymous_provider_disabled') || 
          error.message?.includes('Anonymous sign-ins are disabled')) {
        toast.error('Voting requires anonymous authentication. Please contact support.', { duration: 5000 });
        return false;
      }
      
      toast.error('Voting temporarily unavailable. Please retry.', { duration: 3000 });
      return false;
    }
    
    if (!data?.user) {
      toast.error('Voting temporarily unavailable. Please retry.', { duration: 3000 });
      return false;
    }
    
    // Session created successfully
    return true;
  } catch (error: any) {
    // Handle specific error: anonymous provider disabled
    if (error?.message?.includes('anonymous_provider_disabled') || 
        error?.message?.includes('Anonymous sign-ins are disabled')) {
      toast.error('Voting requires anonymous authentication. Please contact support.', { duration: 5000 });
      return false;
    }
    
    toast.error('Voting temporarily unavailable. Please retry.', { duration: 3000 });
    return false;
  }
}

