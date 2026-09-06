import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, BarChart3, Download } from 'lucide-react';
import { useTeams, useTeamMembers } from '../../hooks/useTeams';
import { useOrganization } from '../../hooks/useOrganization';
import { useOrgDashboardData } from '../../hooks/useOrgDashboardData';
import { useAnalystDetails } from '../../hooks/useAnalystDetails';
import { Button } from '../ui/button';
import TeamSelector from './TeamSelector';
import TeamJoinRequests from './TeamJoinRequests';
import DashboardStatCards from './dashboard/DashboardStatCards';
import AnalystPerformanceTable from './dashboard/AnalystPerformanceTable';
import AnalystRecommendationList from './dashboard/AnalystRecommendationList';
import ExportPerformanceModal from './dashboard/ExportPerformanceModal';
import { formatPercent } from './dashboard/types';

/**
 * A portfolio manager's view of the desks they run.
 *
 * Deliberately not the Admin Dashboard with pieces hidden: there is no join code, no
 * role control and no Danger Zone here, because a portfolio manager administers a
 * team, not an organization. What it does share -- the roster table, the row detail,
 * the export -- comes from ./dashboard, so the two stay in step.
 *
 * A manager's teams are their team_members rows, which is exactly what getMyTeams
 * returns, so useTeams with no orgId is already the right question.
 */
export default function TeamDashboard() {
  const navigate = useNavigate();
  // Same reasoning as AdminDashboard: read the organization from useOrganization
  // rather than running a second membership query off a session that is null for
  // the first render.
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? null;
  // Holds only an explicit choice. The effective team falls back to the first one,
  // derived rather than written back in an effect -- that would set state during
  // render-commit and give every single-team manager an extra render with no team.
  const [pickedTeamId, setPickedTeamId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const { teams, loading: teamsLoading } = useTeams();
  const selectedTeamId = pickedTeamId ?? teams[0]?.id ?? null;
  const { members } = useTeamMembers(selectedTeamId);
  const memberIds = members.map((m) => m.userId);

  const { performance, loading, error } = useOrgDashboardData({
    orgId: organizationId,
    restrictToUserIds: memberIds,
    // Waiting for both the org and a resolved roster keeps this from firing once
    // with an empty restriction, which would briefly load the whole organization.
    enabled: !!organizationId && !!selectedTeamId && memberIds.length > 0,
  });

  const { expandedUserId, recommendations, irrTargets, toggle, reset } =
    useAnalystDetails(selectedTeamId);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  if (teamsLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading team data...</div>
      </div>
    );
  }

  // A portfolio manager with no teams is an expected state, not an error: the role
  // is granted by an admin, and being added to a team is a separate action.
  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass rounded-xl shadow-xl p-8 text-center">
          <Users className="w-10 h-10 mx-auto mb-4 text-indigo-400" />
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">No teams yet</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            You are not a member of any team. Ask an organization admin to add you to one, and
            your team's performance will appear here.
          </p>
          <button
            onClick={() => navigate('/recommendations')}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md hover:from-indigo-400 hover:to-purple-400 transition-all duration-200"
          >
            Go to Recommendations
          </button>
        </div>
      </div>
    );
  }

  const avgReturn =
    performance.length > 0
      ? formatPercent(
          performance.reduce((sum, p) => sum + p.returns['12M'], 0) / performance.length
        )
      : 'N/A';

  const totalIdeas = performance.reduce((sum, p) => sum + p.totalRecommendations, 0);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Team Dashboard</h1>
              <p className="text-[var(--text-secondary)]">
                {selectedTeam?.name || 'Select a team'}
              </p>
            </div>
            <Button
              onClick={() => setShowExportModal(true)}
              disabled={memberIds.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400 transition-all duration-200 shadow-lg shadow-indigo-500/25"
            >
              <Download className="w-4 h-4" />
              Export Performance
            </Button>
          </div>

          {/* Only worth a control when there is a choice to make. */}
          {teams.length > 1 && (
            <div className="glass rounded-xl shadow-xl border border-[var(--border-color)] p-4">
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm font-medium text-[var(--text-primary)]">Team:</label>
                <TeamSelector
                  teams={teams}
                  selectedTeamId={selectedTeamId}
                  onSelectTeam={(teamId) => {
                    setPickedTeamId(teamId);
                    reset();
                  }}
                  showAllOption={false}
                />
              </div>
            </div>
          )}
        </div>

        <DashboardStatCards
          cards={[
            { label: 'Team Members', value: String(memberIds.length), icon: Users, iconClass: 'text-indigo-400' },
            { label: 'Total Ideas', value: String(totalIdeas), icon: BarChart3, iconClass: 'text-green-400' },
            { label: 'Avg 12M Return', value: avgReturn, icon: TrendingUp, iconClass: 'text-purple-400' },
          ]}
        />

        {error && (
          <div className="glass rounded-xl border border-red-500/30 p-4 mb-8 text-red-300">{error}</div>
        )}

        <AnalystPerformanceTable
          title="Team Performance"
          rows={performance}
          expandedUserId={expandedUserId}
          onToggle={toggle}
          renderExpanded={(userId) => (
            <AnalystRecommendationList
              recommendations={recommendations[userId] || []}
              irrTargets={irrTargets[userId] || []}
            />
          )}
          emptyLabel={loading ? 'Loading team performance...' : 'This team has no analysts yet'}
        />

        {/* The Edge Function scopes a portfolio manager to their own teams, so this
            needs no extra filtering here. */}
        {organizationId && <TeamJoinRequests orgId={organizationId} />}

        <ExportPerformanceModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
          userIds={memberIds}
          filenamePrefix={`team_${(selectedTeam?.name || 'export').replace(/\W+/g, '_').toLowerCase()}`}
        />
      </div>
    </div>
  );
}
