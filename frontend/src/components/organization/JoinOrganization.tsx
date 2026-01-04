import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { joinOrganization } from '../../lib/edgeFunctions';
import { supabase } from '../../lib/supabase';
import { ArrowLeft } from 'lucide-react';

export default function JoinOrganization() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingOrg, setCheckingOrg] = useState(true);

  // Check if user is already part of an organization
  useEffect(() => {
    const checkExistingOrganization = async () => {
      if (!clerkLoaded) return;

      if (!clerkUser) {
        setError('You must be logged in to join an organization');
        setCheckingOrg(false);
        return;
      }

      try {
        // Get Supabase session
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        const supabaseUserId = supabaseSession?.user?.id;

        if (!supabaseUserId) {
          // User not synced yet, but that's okay - they can still join an org
          setCheckingOrg(false);
          return;
        }

        // Check if user is already in an organization
        const { data, error: orgError } = await supabase
          .from('user_organization_membership')
          .select('organization_id, role, organizations(id, name)')
          .eq('user_id', supabaseUserId)
          .maybeSingle();

        if (!orgError && data) {
          // User is already in an organization
          if (data.role === 'admin') {
            // Redirect admin to admin dashboard
            navigate('/organization/admin', { replace: true });
          } else {
            // Redirect member to dashboard
            navigate('/', { replace: true });
          }
        } else {
          // User is not in an organization, allow them to join one
          setCheckingOrg(false);
        }
      } catch (err) {
        // Allow user to proceed if check fails
        setCheckingOrg(false);
      }
    };

    checkExistingOrganization();
  }, [clerkUser, clerkLoaded, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Verify Clerk user is authenticated
    if (!clerkUser) {
      setError('You must be logged in to join an organization');
      setLoading(false);
      return;
    }

    try {
      // Use Clerk user ID directly - edge function will look up Supabase user
      const result = await joinOrganization(
        joinCode.trim(),
        undefined, // userId - will be set by edge function
        clerkUser.id // clerkUserId - used to look up Supabase user
      );
      // Redirect to dashboard on success
      navigate('/', {
        state: {
          message: `Successfully joined ${result.organizationName}`
        }
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to join organization';
      // Provide more helpful error messages
      if (errorMessage.includes('User not synced')) {
        setError('Your account is still syncing. Please wait a moment and try again.');
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        setError('Authentication failed. Please log out and log back in.');
      } else {
        setError(errorMessage);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="max-w-md w-full glass rounded-xl shadow-xl p-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">
          Join Organization
        </h2>
        <p className="text-slate-300 mb-6">
          Enter the join code provided by your organization admin.
        </p>

        {!clerkLoaded || checkingOrg ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-slate-300">Loading...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="joinCode" className="block text-sm font-medium text-slate-200 mb-2">
                Join Code
              </label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2 border border-white/10 rounded-md bg-slate-900/50 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter join code"
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !joinCode.trim() || !clerkUser}
              className="w-full px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md hover:from-indigo-400 hover:to-purple-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:shadow-none"
            >
              {loading ? 'Joining...' : 'Join Organization'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

