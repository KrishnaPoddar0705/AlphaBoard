/**
 * Auth Callback Page
 * Handles Supabase magic link callbacks for session creation
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Extract token from URL
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type') || 'magiclink';

      if (tokenHash) {
        try {
          // Verify the token and create session
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'magiclink' | 'email' | 'recovery',
          });

          if (error) {
            console.error('Auth callback error:', error);
            navigate('/login?error=auth_failed');
            return;
          }

          if (data.session) {
            // Session created successfully, redirect to dashboard
            navigate('/');
          } else {
            navigate('/login?error=no_session');
          }
        } catch (err) {
          console.error('Error handling auth callback:', err);
          navigate('/login?error=callback_failed');
        }
      } else {
        // No token, redirect to login
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

