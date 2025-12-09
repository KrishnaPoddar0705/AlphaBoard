import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { useTeams, useTeamMembers } from '../hooks/useTeams';
import { useOrganization } from '../hooks/useOrganization';
import CreateTeamModal from '../components/organization/CreateTeamModal';
import { getOrgTeams } from '../lib/edgeFunctions';
import { User, Edit2, Save, X, Users, Plus, Mail, Calendar, MapPin, Globe, LogIn, LogOut } from 'lucide-react';

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
  const { teams: myTeams, loading: teamsLoading, createTeam, joinTeam, removeMember, refresh: refreshTeams } = useTeams({ 
    orgId: organization?.id, 
    autoFetch: !!organization?.id 
  });
  const [allOrgTeams, setAllOrgTeams] = useState<any[]>([]);
  const [loadingAllTeams, setLoadingAllTeams] = useState(false);
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
    if (organization?.id) {
      fetchAllOrgTeams();
    }
  }, [organization?.id]);

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
    await createTeam(name);
    refreshTeams();
    fetchAllOrgTeams();
    setShowCreateTeamModal(false);
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      await joinTeam(teamId);
      refreshTeams();
      fetchAllOrgTeams();
    } catch (err: any) {
      alert(err.message || 'Failed to join team');
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

  // Get teams user is NOT part of
  const availableTeams = allOrgTeams.filter(
    (team) => !myTeams.some((myTeam) => myTeam.id === team.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Failed to load profile</div>
      </div>
    );
  }

  const displayName = profile.full_name || profile.username || clerkUser?.fullName || 'User';
  const displayEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-32"></div>
          <div className="px-6 pb-6 -mt-16">
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-end gap-4">
                <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                  {profile.username && (
                    <p className="text-gray-600 text-sm">@{profile.username}</p>
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
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-800">{displayEmail}</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-800">{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                    {profile.website}
                  </a>
                </div>
              )}
              {profile.created_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-800">Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {profile.bio && !editing && (
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
            )}

            {/* Edit Form */}
            {editing && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md font-medium">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md font-medium">
                    {success}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    placeholder="Your full name"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white resize-y"
                    placeholder="Tell us about yourself..."
                    maxLength={500}
                  />
                  {bio.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{bio.length}/500 characters</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    placeholder="City, Country"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    id="website"
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400 bg-white"
                    placeholder="https://yourwebsite.com"
                    maxLength={200}
                  />
                  {website && !website.match(/^https?:\/\//) && website.trim() && (
                    <p className="mt-1 text-xs text-amber-700 font-medium">
                      Tip: Include http:// or https:// for the link to work properly
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
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

        {/* Teams Section */}
        {organization && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">My Teams</h2>
              </div>
              <button
                onClick={() => setShowCreateTeamModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Team
              </button>
            </div>

            {teamsLoading ? (
              <div className="text-gray-400 text-center py-8">Loading teams...</div>
            ) : (
              <>
                {/* My Teams */}
                {myTeams.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Teams I'm In</h3>
                    <div className="space-y-3">
                      {myTeams.map((team) => (
                        <TeamCard 
                          key={team.id} 
                          team={team} 
                          isMember={true}
                          onLeave={() => handleLeaveTeam(team.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Teams to Join */}
                {availableTeams.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Available Teams</h3>
                    <div className="space-y-3">
                      {availableTeams.map((team) => (
                        <TeamCard 
                          key={team.id} 
                          team={team} 
                          isMember={false}
                          onJoin={() => handleJoinTeam(team.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {myTeams.length === 0 && availableTeams.length === 0 && !loadingAllTeams && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="mb-4">No teams available yet.</p>
                    <button
                      onClick={() => setShowCreateTeamModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Create Your First Team
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!organization && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 mb-4">Join or create an organization to access teams.</p>
            <div className="flex gap-4 justify-center">
              <a href="/organization/join" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Join Organization
              </a>
              <a href="/organization/create" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                Create Organization
              </a>
            </div>
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
function TeamCard({ team, isMember, onJoin, onLeave }: { team: any; isMember: boolean; onJoin?: () => void; onLeave?: () => void }) {
  const { session } = useAuth();
  const { members, loading } = useTeamMembers(isMember ? team.id : null);
  const [expanded, setExpanded] = useState(false);
  
  // For non-members, we don't need to show members, so don't fetch
  const shouldShowMembers = isMember && expanded;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex-1 cursor-pointer" onClick={() => isMember && setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{team.name}</h3>
            {isMember && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Member</span>
            )}
          </div>
          {team.createdAt && (
            <p className="text-sm text-gray-500">
              Created {new Date(team.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isMember ? (
            <>
              {!loading && (
                <span className="text-sm text-gray-500">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <X className="w-4 h-4 text-gray-400" /> : <Users className="w-4 h-4 text-gray-400" />}
              </button>
              {onLeave && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLeave();
                  }}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors flex items-center gap-1"
                  title="Leave team"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onJoin}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 flex items-center gap-1 transition-colors"
            >
              <LogIn className="w-3 h-3" />
              Join
            </button>
          )}
        </div>
      </div>

      {shouldShowMembers && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {loading ? (
            <div className="text-gray-400 text-sm text-center py-2">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-2">No members yet</div>
          ) : (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700 mb-2">Members ({members.length})</h4>
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {member.profile?.username || 'Unknown User'}
                    </div>
                    {member.profile?.email && (
                      <div className="text-xs text-gray-500 truncate">{member.profile.email}</div>
                    )}
                  </div>
                  {member.userId === session?.user?.id && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded flex-shrink-0">You</span>
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

