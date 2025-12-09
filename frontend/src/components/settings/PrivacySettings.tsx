import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Lock, Globe } from 'lucide-react';

export default function PrivacySettings() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPrivacySettings();
    } else {
      setLoading(false);
      setError('You must be logged in to access this page');
    }
  }, [session]);

  const fetchPrivacySettings = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('is_private')
        .eq('id', session!.user!.id)
        .single();

      if (fetchError) throw fetchError;

      setIsPrivate(data?.is_private || false);
    } catch (err: any) {
      setError(err.message || 'Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePrivacy = async () => {
    if (!session?.user?.id) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const newPrivacyValue = !isPrivate;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_private: newPrivacyValue })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setIsPrivate(newPrivacyValue);
      setSuccess(
        newPrivacyValue
          ? 'Profile set to private. Your portfolio will only be visible to you.'
          : 'Profile set to public. Your portfolio will appear in the leaderboard.'
      );
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading privacy settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-white mb-8">Privacy Settings</h1>

        <div className="bg-slate-800/50 border border-white/10 rounded-lg shadow p-6">
          {success && (
            <div className="mb-6 bg-green-900/30 border border-green-500/30 text-green-300 px-4 py-3 rounded-md">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Profile Visibility */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    {isPrivate ? <Lock className="w-5 h-5 text-slate-300" /> : <Globe className="w-5 h-5 text-slate-300" />}
                    Profile Visibility
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    {isPrivate
                      ? 'Your profile and portfolio are private. Only you can see your data.'
                      : 'Your profile and portfolio are public. They will appear in the leaderboard.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={handleTogglePrivacy}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Privacy Explanation */}
            <div className="border-t border-white/10 pt-6">
              <h4 className="font-semibold text-white mb-2">How Privacy Works</h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>
                    <strong className="text-white">Public Profile:</strong> Your recommendations, portfolio, and performance
                    metrics are visible to everyone in the public leaderboard.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>
                    <strong className="text-white">Private Profile:</strong> Your data is only visible to you. If you're in
                    an organization, admins can also view your data.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>
                    <strong className="text-white">Organization Members:</strong> If you're part of an organization, your
                    data is always visible to organization admins, regardless of privacy settings.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

