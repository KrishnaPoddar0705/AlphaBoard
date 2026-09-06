import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

interface Organization {
  id: string;
  name: string;
  role: 'admin' | 'analyst';
  // False only for organizations that have explicitly opted out of share
  // quantities and the paper portfolio. Absent column reads as enabled.
  paperPortfolioEnabled: boolean;
}

export function useOrganization() {
  const { session, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The Supabase session is established asynchronously after Clerk loads, so
    // a missing session while auth is still resolving is not the same as being
    // signed out. Reporting "loaded, no organization" during that window makes
    // callers act on an answer that is about to change.
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!session?.user?.id) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    fetchOrganization();
  }, [session, authLoading]);

  const fetchOrganization = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_organization_membership')
        .select('organization_id, role, organizations(id, name, paper_portfolio_enabled)')
        .eq('user_id', session!.user!.id)
        .maybeSingle();

      if (!error && data) {
        const org = data.organizations as any;
        setOrganization({
          id: data.organization_id,
          name: org?.name || 'Unknown',
          role: data.role,
          // Only an explicit false disables it, so an org row from before the
          // migration behaves exactly as it does today.
          paperPortfolioEnabled: org?.paper_portfolio_enabled !== false,
        });
      } else {
        setOrganization(null);
      }
    } catch (err) {
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  };

  return { organization, loading, refetch: fetchOrganization };
}

