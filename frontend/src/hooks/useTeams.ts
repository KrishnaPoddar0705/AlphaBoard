import { useState, useEffect, useCallback } from 'react';
import {
  createTeam,
  joinTeam,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
  getMyTeams,
  getOrgTeams,
  type Team,
  type TeamMember,
} from '../lib/edgeFunctions';

interface UseTeamsOptions {
  orgId?: string;
  autoFetch?: boolean;
}

export function useTeams(options: UseTeamsOptions = {}) {
  const { orgId, autoFetch = true } = options;
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyTeams = useCallback(async () => {
    if (!autoFetch) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await getMyTeams();
      setTeams(response.teams || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch teams';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [autoFetch]);

  const fetchOrgTeams = useCallback(async () => {
    if (!orgId || !autoFetch) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await getOrgTeams(orgId);
      setTeams(response.teams || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch organization teams';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [orgId, autoFetch]);

  useEffect(() => {
    if (orgId) {
      fetchOrgTeams();
    } else {
      fetchMyTeams();
    }
  }, [orgId, fetchOrgTeams, fetchMyTeams]);

  const createTeamHandler = useCallback(async (name: string) => {
    if (!orgId) {
      throw new Error('Organization ID is required to create a team');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await createTeam(orgId, name);
      // Refresh teams list
      if (orgId) {
        await fetchOrgTeams();
      } else {
        await fetchMyTeams();
      }
      return response.team;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create team';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [orgId, fetchOrgTeams, fetchMyTeams]);

  const joinTeamHandler = useCallback(async (teamId: string) => {
    setLoading(true);
    setError(null);
    try {
      await joinTeam(teamId);
      // Refresh teams list
      if (orgId) {
        await fetchOrgTeams();
      } else {
        await fetchMyTeams();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join team';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [orgId, fetchOrgTeams, fetchMyTeams]);

  const addMemberHandler = useCallback(async (teamId: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      await addTeamMember(teamId, userId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add team member';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeMemberHandler = useCallback(async (teamId: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      await removeTeamMember(teamId, userId);
      // Refresh teams list
      if (orgId) {
        await fetchOrgTeams();
      } else {
        await fetchMyTeams();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove team member';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [orgId, fetchOrgTeams, fetchMyTeams]);

  return {
    teams,
    loading,
    error,
    createTeam: createTeamHandler,
    joinTeam: joinTeamHandler,
    addMember: addMemberHandler,
    removeMember: removeMemberHandler,
    refresh: orgId ? fetchOrgTeams : fetchMyTeams,
  };
}

export function useTeamMembers(teamId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!teamId) {
      setMembers([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getTeamMembers(teamId);
      setMembers(response.members || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch team members';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    refresh: fetchMembers,
  };
}

