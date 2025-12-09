import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { Team } from '../../lib/edgeFunctions';

interface TeamSelectorProps {
  teams: Team[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string | null) => void;
  loading?: boolean;
  showAllOption?: boolean;
}

export default function TeamSelector({
  teams,
  selectedTeamId,
  onSelectTeam,
  loading = false,
  showAllOption = true,
}: TeamSelectorProps) {
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="relative">
      <select
        value={selectedTeamId || ''}
        onChange={(e) => onSelectTeam(e.target.value || null)}
        disabled={loading}
        className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {showAllOption && (
          <option value="">All Teams</option>
        )}
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
        {teams.length === 0 && !loading && (
          <option value="" disabled>
            No teams available
          </option>
        )}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <ChevronDown size={16} className="text-gray-400" />
      </div>
    </div>
  );
}

