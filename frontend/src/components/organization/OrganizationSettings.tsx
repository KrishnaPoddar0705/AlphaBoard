import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { getOrganizationUsers, updateOrganizationSettings, removeAnalyst } from '../../lib/edgeFunctions';
import { Trash2, Save, ArrowLeft, Users, Settings } from 'lucide-react';
import TeamManagement from './TeamManagement';

interface OrganizationUser {
  userId: string;
  username: string | null;
  email: string | null;
  role: 'admin' | 'analyst';
  joinedAt: string;
}

export default function OrganizationSettings() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'teams'>('general');

  useEffect(() => {
    if (!session?.user?.id) {
      navigate('/');
      return;
    }

    fetchOrganizationData();
  }, [session]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's organization membership
      const { data: membership, error: membershipError } = await supabase
        .from('user_organization_membership')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', session!.user!.id)
        .single();

      if (membershipError || !membership) {
        setError('You are not a member of any organization');
        setLoading(false);
        return;
      }

      // Allow all organization members to access (admins see General tab, all see Teams tab)
      setIsAdmin(membership.role === 'admin');
      const org = membership.organizations as any;
      setOrganizationId(membership.organization_id);
      setOrganizationName(org?.name || '');

      // Fetch users (only if admin)
      if (membership.role === 'admin') {
        const usersData = await getOrganizationUsers(membership.organization_id);
        setUsers([...usersData.analysts, ...usersData.admins]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!organizationId || !organizationName.trim()) {
      setError('Organization name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await updateOrganizationSettings(organizationId, organizationName.trim());
      setSuccess('Organization name updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update organization name');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAnalyst = async (analystUserId: string, username: string | null) => {
    if (!organizationId) return;

    if (
      !confirm(
        `Are you sure you want to remove ${username || 'this analyst'} from the organization? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setError(null);
      await removeAnalyst(organizationId, analystUserId);
      setSuccess(`${username || 'Analyst'} removed successfully`);
      // Refresh users list
      const usersData = await getOrganizationUsers(organizationId);
      setUsers([...usersData.analysts, ...usersData.admins]);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove analyst');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading organization settings...</div>
      </div>
    );
  }

  if (error && !organizationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Organization Settings</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'general'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                General
              </div>
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'teams'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Teams
              </div>
            </button>
          </nav>
        </div>

        {activeTab === 'general' && isAdmin && (
          <>
            {/* Organization Name */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Organization Name</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Organization name"
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Organization Members</h2>
              </div>
              <div className="p-6">
                {success && (
                  <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    {success}
                  </div>
                )}
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.username || 'Unknown User'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Joined {formatDate(user.joinedAt)} • {user.role}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.role === 'admin' && (
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            Admin
                          </span>
                        )}
                        {user.role === 'analyst' && (
                          <button
                            onClick={() => handleRemoveAnalyst(user.userId, user.username)}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'teams' && organizationId && (
          <TeamManagement orgId={organizationId} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}

