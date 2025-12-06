import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { createOrganization } from '../../lib/edgeFunctions';
import { supabase } from '../../lib/supabase';
import { Copy, Check, ArrowLeft } from 'lucide-react';

export default function CreateOrganization() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingOrg, setCheckingOrg] = useState(true);

  // Check if user is already part of an organization
  useEffect(() => {
    const checkExistingOrganization = async () => {
      if (!clerkLoaded) return;

      if (!clerkUser) {
        setError('You must be logged in to create an organization');
        setCheckingOrg(false);
        return;
      }

      try {
        // Get Supabase session
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        const supabaseUserId = supabaseSession?.user?.id;

        if (!supabaseUserId) {
          // User not synced yet, but that's okay - they can still create an org
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
          // User is not in an organization, allow them to create one
          setCheckingOrg(false);
        }
      } catch (err) {
        console.error('Error checking organization:', err);
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
      setError('You must be logged in to create an organization');
      setLoading(false);
      return;
    }

    try {
      // Use Clerk user ID directly - edge function will look up Supabase user
      const result = await createOrganization(
        organizationName.trim(),
        undefined, // adminUserId - will be set by edge function
        clerkUser.id // clerkUserId - used to look up Supabase user
      );
      setJoinCode(result.joinCode);
      setSuccess(true);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create organization';
      // Provide more helpful error messages
      if (errorMessage.includes('User not synced')) {
        setError('Your account is still syncing. Please wait a moment and try again.');
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        setError('Authentication failed. Please log out and log back in.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (joinCode) {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (success && joinCode) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass rounded-xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Organization Created!
            </h2>
            <p className="text-slate-300">
              Your organization <strong className="text-white">{organizationName}</strong> has been created successfully.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6 mb-6 border border-white/10">
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Join Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                readOnly
                className="flex-1 px-4 py-2 border border-white/10 rounded-md bg-slate-900/50 text-white font-mono text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md hover:from-indigo-400 hover:to-purple-400 flex items-center gap-2 transition-all duration-200 shadow-lg shadow-indigo-500/25"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Share this code with analysts to invite them to your organization.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/organization/admin')}
              className="w-full px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md hover:from-indigo-400 hover:to-purple-400 transition-all duration-200 shadow-lg shadow-indigo-500/25"
            >
              Go to Admin Dashboard
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-4 py-2 bg-slate-700/50 text-slate-200 rounded-md hover:bg-slate-700 border border-white/10 transition-all duration-200"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          Create Organization
        </h2>
        <p className="text-slate-300 mb-6">
          Create a new organization to manage analysts and track performance.
        </p>

        {!clerkLoaded || checkingOrg ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-slate-300">Loading...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-200 mb-2">
                Organization Name
              </label>
              <input
                id="name"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2 border border-white/10 rounded-md bg-slate-900/50 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="e.g., Acme Capital"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !organizationName.trim() || !clerkUser}
              className="w-full px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md hover:from-indigo-400 hover:to-purple-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:shadow-none"
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

