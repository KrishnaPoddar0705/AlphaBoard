import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { createOrganization } from '../../lib/edgeFunctions';
import { Copy, Check, ArrowLeft } from 'lucide-react';

export default function CreateOrganization() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!session?.user?.id) {
      setError('You must be logged in to create an organization');
      setLoading(false);
      return;
    }

    try {
      const result = await createOrganization(organizationName.trim(), session.user.id);
      setJoinCode(result.joinCode);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Organization Created!
            </h2>
            <p className="text-gray-600">
              Your organization <strong>{organizationName}</strong> has been created successfully.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Join Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-white font-mono text-lg font-semibold"
              />
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
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
            <p className="text-sm text-gray-500 mt-2">
              Share this code with analysts to invite them to your organization.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/organization/admin')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go to Admin Dashboard
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Create Organization
        </h2>
        <p className="text-gray-600 mb-6">
          Create a new organization to manage analysts and track performance.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              id="name"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Acme Capital"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !organizationName.trim()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      </div>
    </div>
  );
}

