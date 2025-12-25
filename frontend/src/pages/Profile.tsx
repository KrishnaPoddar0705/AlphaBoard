import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { useTeams, useTeamMembers } from '../hooks/useTeams';
import { useOrganization } from '../hooks/useOrganization';
import CreateTeamModal from '../components/organization/CreateTeamModal';
import { getOrgTeams, getTeamJoinRequests, approveTeamJoinRequest, rejectTeamJoinRequest, joinTeam as joinTeamFn } from '../lib/edgeFunctions';
import { User, Edit2, Save, X, Users, Plus, Mail, Calendar, MapPin, Globe, LogIn, LogOut } from 'lucide-react';
import WhatsAppConnect from '../components/settings/WhatsAppConnect';

interface ProfileData {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  website: string | null;
  email?: string | null;
  created_at?: string;
}

export default function Profile() {
  const { session } = useAuth();
  const { user: clerkUser } = useUser();
  const { organization } = useOrganization();
  // Get only teams user is a member of (not all org teams)
  // Use separate hooks: one for fetching user's teams (no orgId), one for creating teams (with orgId)
  const { teams: myTeams, loading: teamsLoading, removeMember, refresh: refreshTeams } = useTeams({ 
    orgId: undefined, // Don't pass orgId to get only user's teams
    autoFetch: !!organization?.id 
  });
  
  // For creating teams, we need orgId, so we'll use the edge function directly
  const createTeamWithOrg = useCallback(async (name: string) => {
    if (!organization?.id) {
      throw new Error('Organization ID is required to create a team');
    }
    const { createTeam: createTeamFn } = await import('../lib/edgeFunctions');
    const result = await createTeamFn(organization.id, name);
    refreshTeams(); // Refresh user's teams
    fetchAllOrgTeams(); // Refresh all org teams
    return result.team;
  }, [organization?.id, refreshTeams]);
  const [allOrgTeams, setAllOrgTeams] = useState<any[]>([]);
  const [loadingAllTeams, setLoadingAllTeams] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminJoinRequests, setAdminJoinRequests] = useState<any[]>([]);
  const [loadingAdminRequests, setLoadingAdminRequests] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (organization?.id && session?.user?.id) {
      fetchUserRole();
      fetchAllOrgTeams();
      fetchPendingRequests();
    }
  }, [organization?.id, session?.user?.id]);

  useEffect(() => {
    if (isAdmin && organization?.id) {
      fetchAdminJoinRequests();
    }
  }, [isAdmin, organization?.id]);

  const fetchAllOrgTeams = async () => {
    if (!organization?.id) return;
    
    try {
      setLoadingAllTeams(true);
      const response = await getOrgTeams(organization.id);
      setAllOrgTeams(response.teams || []);
    } catch (err) {
      console.error('Error fetching all org teams:', err);
    } finally {
      setLoadingAllTeams(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!organization?.id || !session?.user?.id) return;
    
    try {
      const { data: requests } = await supabase
        .from('team_join_requests')
        .select('team_id')
        .eq('user_id', session.user.id)
        .eq('status', 'pending');
      
      const requestTeamIds = new Set(requests?.map((r: any) => r.team_id) || []);
      setPendingRequests(requestTeamIds);
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  };

  const fetchUserRole = async () => {
    if (!session?.user?.id || !organization?.id) return;
    
    try {
      const { data: membership } = await supabase
        .from('user_organization_membership')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('organization_id', organization.id)
        .single();
      
      setIsAdmin(membership?.role === 'admin' || false);
    } catch (err) {
      console.error('Error fetching user role:', err);
      setIsAdmin(false);
    }
  };

  const fetchAdminJoinRequests = async () => {
    if (!isAdmin || !organization?.id) return;
    
    try {
      setLoadingAdminRequests(true);
      const response = await getTeamJoinRequests(organization.id);
      setAdminJoinRequests(response.requests || []);
    } catch (err: any) {
      console.error('Error fetching admin join requests:', err);
    } finally {
      setLoadingAdminRequests(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await approveTeamJoinRequest(requestId);
      setSuccess('Join request approved!');
      setTimeout(() => setSuccess(null), 3000);
      await fetchAdminJoinRequests();
      await fetchPendingRequests();
      refreshTeams();
      fetchAllOrgTeams();
    } catch (err: any) {
      setError(err.message || 'Failed to approve request');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this join request?')) {
      return;
    }
    
    try {
      await rejectTeamJoinRequest(requestId);
      setSuccess('Join request rejected.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchAdminJoinRequests();
      await fetchPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to reject request');
      setTimeout(() => setError(null), 5000);
    }
  };

  const fetchProfile = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, bio, avatar_url, location, website, created_at')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setBio(data.bio || '');
        setLocation(data.location || '');
        setWebsite(data.website || '');
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          location: location.trim() || null,
          website: website.trim() || null,
        })
        .eq('id', session.user.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess('Profile updated successfully');
      setEditing(false);
      await fetchProfile();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
    }
    setEditing(false);
    setError(null);
  };

  const handleCreateTeam = async (name: string) => {
    try {
      await createTeamWithOrg(name);
      setSuccess('Team created successfully!');
      setTimeout(() => setSuccess(null), 3000);
      setShowCreateTeamModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      // Call joinTeam directly from edgeFunctions (not from useTeams hook)
      const result = await joinTeamFn(teamId);
      
      if (result && typeof result === 'object' && 'requiresApproval' in result && result.requiresApproval) {
        setSuccess('Join request sent! Waiting for admin approval.');
        setTimeout(() => setSuccess(null), 5000);
        await fetchPendingRequests();
        if (isAdmin) {
          await fetchAdminJoinRequests();
        }
      } else {
        const message = result && typeof result === 'object' && 'message' in result ? result.message : 'Successfully joined team!';
        setSuccess(message);
        setTimeout(() => setSuccess(null), 3000);
        refreshTeams();
        fetchAllOrgTeams();
        await fetchPendingRequests();
        if (isAdmin) {
          await fetchAdminJoinRequests();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join team');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!session?.user?.id) return;
    
    if (!confirm('Are you sure you want to leave this team?')) {
      return;
    }

    try {
      await removeMember(teamId, session.user.id);
      refreshTeams();
      fetchAllOrgTeams();
    } catch (err: any) {
      alert(err.message || 'Failed to leave team');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-red-400">Failed to load profile</div>
      </div>
    );
  }

  const displayName = profile.full_name || profile.username || clerkUser?.fullName || 'User';
  const displayEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-32"></div>
          <div className="px-6 pb-6 -mt-16">
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-end gap-4">
                <div className="w-24 h-24 rounded-full bg-[var(--card-bg)] border-4 border-[var(--card-bg)] shadow-lg flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-[var(--text-secondary)]" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">{displayName}</h1>
                  {profile.username && (
                    <p className="text-[var(--text-secondary)] text-sm">@{profile.username}</p>
                  )}
                </div>
              </div>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </button>
              )}
            </div>

            {/* Profile Info */}
            <div className="space-y-2 mb-4">
              {displayEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]">{displayEmail}</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]">{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--text-secondary)]" />
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline font-medium">
                    {profile.website}
                  </a>
                </div>
              )}
              {profile.created_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]">Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {profile.bio && !editing && (
              <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
            )}

            {/* Success/Error Messages */}
            {success && (
              <div className="mt-4 bg-green-900/30 border border-green-500/30 text-green-300 px-4 py-3 rounded-md font-medium">
                {success}
              </div>
            )}
            {error && (
              <div className="mt-4 bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-md font-medium">
                {error}
              </div>
            )}

            {/* Edit Form */}
            {editing && (
              <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                {error && (
                  <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-md font-medium">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-900/30 border border-green-500/30 text-green-300 px-4 py-3 rounded-md font-medium">
                    {success}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] bg-[var(--card-bg)]"
                    placeholder="Your full name"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] bg-[var(--card-bg)] resize-y"
                    placeholder="Tell us about yourself..."
                    maxLength={500}
                  />
                  {bio.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{bio.length}/500 characters</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] bg-[var(--card-bg)]"
                    placeholder="City, Country"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Website
                  </label>
                  <input
                    id="website"
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] bg-[var(--card-bg)]"
                    placeholder="https://yourwebsite.com"
                    maxLength={200}
                  />
                  {website && !website.match(/^https?:\/\//) && website.trim() && (
                    <p className="mt-1 text-xs text-amber-400 font-medium">
                      Tip: Include http:// or https:// for the link to work properly
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-md hover:bg-[var(--card-bg)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Integration Section */}
        <div className="mb-6">
          <WhatsAppConnect />
        </div>

        {/* Teams Section */}
        {organization && (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--text-secondary)]" />
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Organization Teams</h2>
              </div>
              <button
                onClick={() => setShowCreateTeamModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Team
              </button>
            </div>

            {teamsLoading || loadingAllTeams ? (
              <div className="text-[var(--text-secondary)] text-center py-8">Loading teams...</div>
            ) : allOrgTeams.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <Users className="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p className="mb-4">No teams available yet.</p>
                <button
                  onClick={() => setShowCreateTeamModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Your First Team
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {allOrgTeams.map((team) => {
                  // Check if user is a member by comparing team IDs
                  const isMember = myTeams.some((myTeam) => myTeam.id === team.id);
                  const hasPendingRequest = pendingRequests.has(team.id);
                  
                  return (
                    <TeamCard 
                      key={team.id} 
                      team={team} 
                      isMember={isMember}
                      hasPendingRequest={hasPendingRequest}
                      onJoin={!isMember ? () => handleJoinTeam(team.id) : undefined}
                      onLeave={isMember ? () => handleLeaveTeam(team.id) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!organization && (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
            <p className="text-[var(--text-secondary)] mb-4">Join or create an organization to access teams.</p>
            <div className="flex gap-4 justify-center">
              <a href="/organization/join" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Join Organization
              </a>
              <a href="/organization/create" className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-md hover:bg-[var(--card-bg)]">
                Create Organization
              </a>
            </div>
          </div>
        )}

        {/* Admin Join Requests Section */}
        {isAdmin && organization && (
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--text-secondary)]" />
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Pending Join Requests</h2>
                {adminJoinRequests.length > 0 && (
                  <span className="px-2 py-1 text-xs bg-blue-900/50 text-blue-300 rounded-full border border-blue-500/30">
                    {adminJoinRequests.length}
                  </span>
                )}
              </div>
            </div>

            {loadingAdminRequests ? (
              <div className="text-[var(--text-secondary)] text-center py-8">Loading requests...</div>
            ) : adminJoinRequests.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <Users className="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p>No pending join requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {adminJoinRequests.map((request) => (
                  <div
                    key={request.id}
                    className="border border-[var(--border-color)] rounded-lg p-4 hover:bg-[var(--bg-secondary)] transition-colors bg-[var(--card-bg)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-[var(--text-primary)]">{request.username}</span>
                          <span className="text-sm text-[var(--text-secondary)]">wants to join</span>
                          <span className="font-semibold text-blue-400">{request.teamName}</span>
                        </div>
                        {request.email && (
                          <div className="text-sm text-[var(--text-secondary)] ml-0">{request.email}</div>
                        )}
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">
                          Requested {new Date(request.requestedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <span>✓</span>
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <CreateTeamModal
          isOpen={showCreateTeamModal}
          onClose={() => setShowCreateTeamModal(false)}
          onCreateTeam={handleCreateTeam}
        />
      </div>
    </div>
  );
}

// Team Card Component
function TeamCard({ team, isMember, hasPendingRequest, onJoin, onLeave }: { team: any; isMember: boolean; hasPendingRequest?: boolean; onJoin?: () => void; onLeave?: () => void }) {
  const { session } = useAuth();
  // All users can see team members, not just team members
  const { members, loading } = useTeamMembers(team.id);
  const [expanded, setExpanded] = useState(false);
  
  // Allow expanding to see members for all teams
  const shouldShowMembers = expanded;

  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
      <div className="p-4 flex items-center justify-between">
        <div className="flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)]">{team.name}</h3>
            {isMember && (
              <span className="px-2 py-1 text-xs bg-green-900/50 text-green-300 rounded border border-green-500/30">Member</span>
            )}
          </div>
          {team.createdAt && (
            <p className="text-sm text-[var(--text-secondary)]">
              Created {new Date(team.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <span className="text-sm text-[var(--text-secondary)]">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 hover:bg-[var(--bg-secondary)] rounded transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <X className="w-4 h-4 text-[var(--text-secondary)]" /> : <Users className="w-4 h-4 text-[var(--text-secondary)]" />}
          </button>
          {isMember && onLeave && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLeave();
              }}
              className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors flex items-center gap-1"
              title="Leave team"
            >
              <LogOut className="w-3 h-3" />
            </button>
          )}
          {!isMember && (
            hasPendingRequest ? (
              <span className="px-3 py-1 text-sm bg-amber-900/50 text-amber-300 rounded-md flex items-center gap-1 border border-amber-500/30">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                Request Sent
              </span>
            ) : onJoin ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin();
                }}
                className="px-3 py-1 text-sm bg-blue-900/50 text-blue-300 rounded-md hover:bg-blue-800/50 flex items-center gap-1 transition-colors border border-blue-500/30"
              >
                <LogIn className="w-3 h-3" />
                Join
              </button>
            ) : null
          )}
        </div>
      </div>

      {shouldShowMembers && (
        <div className="border-t border-[var(--border-color)] p-4 bg-[var(--card-bg)]">
          {loading ? (
            <div className="text-[var(--text-secondary)] text-sm text-center py-2">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-[var(--text-secondary)] text-sm text-center py-2">No members yet</div>
          ) : (
            <div className="space-y-2">
              <h4 className="font-medium text-[var(--text-primary)] mb-2">Members ({members.length})</h4>
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-2 p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border-color)] hover:bg-[var(--card-bg)] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {member.profile?.username || 'Unknown User'}
                    </div>
                    {member.profile?.email && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">{member.profile.email}</div>
                    )}
                  </div>
                  {member.userId === session?.user?.id && (
                    <span className="px-2 py-1 text-xs bg-blue-900/50 text-blue-300 rounded flex-shrink-0 border border-blue-500/30">You</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

