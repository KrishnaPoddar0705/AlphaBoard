import { useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import { useTeams, useTeamMembers } from '../../hooks/useTeams';
import CreateTeamModal from './CreateTeamModal';
import type { Team } from '../../lib/edgeFunctions';
import { useAuth } from '../../hooks/useAuth';

interface TeamManagementProps {
  orgId: string;
  isAdmin?: boolean;
}

export default function TeamManagement({ orgId, isAdmin = false }: TeamManagementProps) {
  const { session } = useAuth();
  const { teams, loading, error, createTeam, joinTeam, removeMember, refresh } = useTeams({ orgId });
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const { members: teamMembers, loading: membersLoading, refresh: refreshMembers } = useTeamMembers(
    selectedTeam?.id || null
  );

  const handleCreateTeam = async (name: string) => {
    await createTeam(name);
    refresh();
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      await joinTeam(teamId);
      refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to join team');
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }

    try {
      await removeMember(teamId, userId);
      if (selectedTeam?.id === teamId) {
        refreshMembers();
      }
      refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const toggleTeamExpanded = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
      setSelectedTeam(null);
    } else {
      newExpanded.add(teamId);
      const team = teams.find((t) => t.id === teamId);
      setSelectedTeam(team || null);
      if (team) {
        refreshMembers();
      }
    }
    setExpandedTeams(newExpanded);
  };

  const isUserInTeam = (teamId: string) => {
    if (!session?.user?.id) return false;
    // Check if user is in the team by looking at team members
    // We need to check the current team's members, not all teams
    if (selectedTeam?.id === teamId) {
      return teamMembers.some((m) => m.userId === session.user.id);
    }
    // For other teams, we'd need to fetch their members, but for now
    // we'll check if the team is in the user's teams list
    return false; // Simplified - will be improved when we have team membership info
  };

  const canManageTeam = (team: Team) => {
    if (!session?.user?.id) return false;
    return isAdmin || team.createdBy === session.user.id;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-gray-400 text-center">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Teams</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {teams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="mb-4">No teams yet. Create your first team to get started!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Team
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => {
              const isExpanded = expandedTeams.has(team.id);
              const userInTeam = isUserInTeam(team.id);
              const canManage = canManageTeam(team);

              return (
                <div key={team.id} className="border border-gray-200 rounded-lg">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleTeamExpanded(team.id)}
                        className="text-left flex-1"
                      >
                        <h3 className="font-semibold text-gray-900">{team.name}</h3>
                        {team.createdAt && (
                          <p className="text-sm text-gray-500">
                            Created {new Date(team.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {!userInTeam && (
                        <button
                          onClick={() => handleJoinTeam(team.id)}
                          className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          Join
                        </button>
                      )}
                      {userInTeam && (
                        <span className="px-3 py-1 text-sm bg-green-50 text-green-600 rounded-md">
                          Member
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {membersLoading ? (
                        <div className="text-gray-400 text-sm">Loading members...</div>
                      ) : teamMembers.length === 0 ? (
                        <div className="text-gray-500 text-sm">No members yet</div>
                      ) : (
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-700 mb-2">Members ({teamMembers.length})</h4>
                          {teamMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                            >
                              <div>
                                <div className="font-medium text-sm text-gray-900">
                                  {member.profile?.username || 'Unknown User'}
                                </div>
                                {member.profile?.email && (
                                  <div className="text-xs text-gray-500">{member.profile.email}</div>
                                )}
                              </div>
                              {canManage && member.userId !== session?.user?.id && (
                                <button
                                  onClick={() => handleRemoveMember(team.id, member.userId)}
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                  title="Remove member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateTeam={handleCreateTeam}
      />
    </div>
  );
}

