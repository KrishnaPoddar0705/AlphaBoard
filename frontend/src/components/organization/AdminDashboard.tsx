import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, BarChart3, Download } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { updateMemberRole } from '../../lib/edgeFunctions';
import { useTeams } from '../../hooks/useTeams';
import { useOrgDashboardData } from '../../hooks/useOrgDashboardData';
import { useAnalystDetails } from '../../hooks/useAnalystDetails';
import type { OrgRole } from '../../hooks/useOrganization';
import { safeError } from '../../lib/logger';
import { getUserFriendlyError } from '../../lib/errorSanitizer';
import { Button } from '../ui/button';
import TeamSelector from './TeamSelector';
import DeleteOrganizationDialog from './DeleteOrganizationDialog';
import DashboardStatCards from './dashboard/DashboardStatCards';
import JoinCodePanel from './dashboard/JoinCodePanel';
import AnalystPerformanceTable from './dashboard/AnalystPerformanceTable';
import AnalystRecommendationList from './dashboard/AnalystRecommendationList';
import ExportPerformanceModal from './dashboard/ExportPerformanceModal';
import OrganizationMembersList from './dashboard/OrganizationMembersList';
import { formatPercent } from './dashboard/types';

const ROLE_CHANGE_COPY: Record<OrgRole, (name: string) => string> = {
  admin: (name) =>
    `Make ${name} an admin? They will be able to manage the organization, change roles and delete it.`,
  portfolio_manager: (name) =>
    `Make ${name} a portfolio manager? They will be able to view performance for the teams they belong to, review those teams' join requests and manage their membership. They will not be able to edit other analysts' recommendations, and they will see an empty Team Dashboard until they are added to a team.`,
  analyst: (name) =>
    `Make ${name} an analyst? They will lose any admin or portfolio manager privileges.`,
};

/**
 * Organization-wide dashboard. Admin only -- the route guard in App.tsx enforces
 * that, and the membership check below is defence in depth for a direct mount.
 *
 * The tables, stat cards, export and row detail all live in ./dashboard and are
 * shared with TeamDashboard.
 */
export default function AdminDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamMemberIds, setTeamMemberIds] = useState<Set<string>>(new Set());

  const { teams } = useTeams({ orgId: organizationId || undefined, autoFetch: !!organizationId });
  const { users, performance, joinCode, loading, error, refetch } = useOrgDashboardData({
    orgId: organizationId,
    enabled: !!organizationId,
  });
  const { expandedUserId, recommendations, irrTargets, toggle, reset } =
    useAnalystDetails(selectedTeamId);

  useEffect(() => {
    const resolveOrganization = async () => {
      if (!session?.user?.id) {
        setGateLoading(false);
        setGateError('You must be logged in to access this page');
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from('user_organization_membership')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membershipError) {
        safeError('Membership error:', membershipError);
        setGateError('Failed to load organization membership');
      } else if (!membership) {
        setGateError('You are not a member of any organization');
      } else if (membership.role !== 'admin') {
        setGateError('Only organization admins can access this page');
      } else {
        setOrganizationId(membership.organization_id);
        setOrganizationName((membership.organizations as any)?.name || 'Unknown Organization');
      }
      setGateLoading(false);
    };

    resolveOrganization();
  }, [session]);

  // Which analysts belong to the selected team. Used only to narrow the visible
  // roster; the recommendations themselves are scoped by tag in the Edge Function.
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!selectedTeamId) {
        setTeamMemberIds(new Set());
        return;
      }
      const { data, error: membersError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', selectedTeamId);

      if (membersError) {
        safeError('Error fetching team members:', membersError);
        setTeamMemberIds(new Set());
        return;
      }
      setTeamMemberIds(new Set((data || []).map((tm: any) => tm.user_id)));
    };

    fetchTeamMembers();
  }, [selectedTeamId]);

  const handleChangeRole = async (userId: string, username: string, newRole: OrgRole) => {
    if (!organizationId) return;
    if (!window.confirm(ROLE_CHANGE_COPY[newRole](username))) return;

    try {
      const result = await updateMemberRole(organizationId, userId, newRole);
      alert(result.message || `${username} is now a ${newRole}`);
      refetch();
    } catch (err: any) {
      safeError('Error updating role:', err);
      alert('Failed to update role: ' + getUserFriendlyError(err));
    }
  };

  const handleRemoveUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from the organization?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('user_organization_membership')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (deleteError) {
        safeError('Error removing user:', deleteError);
        alert('Failed to remove user: ' + getUserFriendlyError(deleteError));
        return;
      }

      await supabase.from('profiles').update({ organization_id: null }).eq('id', userId);
      alert(`${username} has been removed from the organization`);
      refetch();
    } catch (err: any) {
      safeError('Error removing user:', err);
      alert('Failed to remove user: ' + getUserFriendlyError(err));
    }
  };

  if (gateLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading organization data...</div>
      </div>
    );
  }

  const shownError = gateError || error;
  if (shownError) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass rounded-xl shadow-xl p-8 text-center">
          <div className="text-red-300 mb-4">{shownError}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md hover:from-indigo-400 hover:to-purple-400 transition-all duration-200"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const visiblePerformance = selectedTeamId
    ? performance.filter((a) => teamMemberIds.has(a.userId))
    : performance;

  const avgReturn =
    performance.length > 0
      ? formatPercent(
          performance.reduce((sum, p) => sum + p.returns['12M'], 0) / performance.length
        )
      : 'N/A';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Admin Dashboard</h1>
              <p className="text-[var(--text-secondary)]">{organizationName}</p>
            </div>
            <Button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400 transition-all duration-200 shadow-lg shadow-indigo-500/25"
            >
              <Download className="w-4 h-4" />
              Export Performance
            </Button>
          </div>

          {joinCode && <JoinCodePanel joinCode={joinCode} />}
        </div>

        <DashboardStatCards
          cards={[
            { label: 'Total Members', value: String(users.length), icon: Users, iconClass: 'text-indigo-400' },
            {
              label: 'Analysts',
              // Counts everyone who writes recommendations, which includes portfolio
              // managers -- they keep every analyst right. Counting role === 'analyst'
              // would drop a member from this tile the moment they were promoted.
              value: String(users.filter((u) => u.role !== 'admin').length),
              icon: BarChart3,
              iconClass: 'text-green-400',
            },
            { label: 'Avg 12M Return', value: avgReturn, icon: TrendingUp, iconClass: 'text-purple-400' },
          ]}
        />

        {teams.length > 0 && (
          <div className="glass rounded-xl shadow-xl mb-8 border border-[var(--border-color)] p-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm font-medium text-[var(--text-primary)]">Filter by Team:</label>
              <TeamSelector
                teams={teams}
                selectedTeamId={selectedTeamId}
                onSelectTeam={(teamId) => {
                  setSelectedTeamId(teamId);
                  // The cached per-analyst recommendations were scoped to the previous
                  // team, so they are stale the moment the filter moves.
                  reset();
                }}
                showAllOption={true}
              />
              {selectedTeamId && (
                <span className="text-xs text-[var(--text-secondary)]">
                  Showing {visiblePerformance.length} analyst
                  {visiblePerformance.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        <AnalystPerformanceTable
          title="Analyst Performance"
          rows={visiblePerformance}
          expandedUserId={expandedUserId}
          onToggle={toggle}
          renderExpanded={(userId) => (
            <AnalystRecommendationList
              recommendations={recommendations[userId] || []}
              irrTargets={irrTargets[userId] || []}
            />
          )}
        />

        <OrganizationMembersList
          users={users}
          currentUserId={session?.user?.id}
          onChangeRole={handleChangeRole}
          onRemove={handleRemoveUser}
        />

        {organizationId && organizationName && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4 sm:p-6">
            <h2 className="text-xl font-bold text-red-600">Danger Zone</h2>
            <p className="mt-1 mb-4 text-sm text-[var(--text-secondary)]">
              Deleting the organization removes every member and cannot be undone.
            </p>
            <DeleteOrganizationDialog
              organizationId={organizationId}
              organizationName={organizationName}
              memberCount={users.length}
              onDeleted={() => navigate('/')}
            />
          </div>
        )}

        <ExportPerformanceModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          userIds={users.map((u) => u.userId)}
        />
      </div>
    </div>
  );
}
