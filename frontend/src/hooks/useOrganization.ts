import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

interface Organization {
  id: string;
  name: string;
  role: 'admin' | 'analyst';
}

export function useOrganization() {
  const { session } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    fetchOrganization();
  }, [session]);

  const fetchOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('user_organization_membership')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', session!.user!.id)
        .maybeSingle();

      if (!error && data) {
        const org = data.organizations as any;
        setOrganization({
          id: data.organization_id,
          name: org?.name || 'Unknown',
          role: data.role,
        });
      } else {
        setOrganization(null);
      }
    } catch (err) {
      console.error('Error fetching organization:', err);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  };

  return { organization, loading, refetch: fetchOrganization };
}

