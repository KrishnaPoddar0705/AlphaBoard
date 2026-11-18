import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'

/** Shown before the organization loads, and for a user with no organization. */
const FALLBACK = 'House View'

/**
 * The name of the desk's own opinion on an entry: "<Org Name> View" (it was hard-coded
 * as "Svan View"). Stored as svan_view / svan_rating in the database; only the label
 * follows the organization.
 *
 * React Query rather than useOrganization: that hook keeps its row in component state,
 * so every caller fetches it again, and this label renders in every Matrix cell.
 */
export function useViewLabel(): string {
  const { ready, userId } = useCommandCenterSession()
  const { data: orgName } = useQuery<string | null>({
    queryKey: [...ccKeys.all, 'org-name', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_organization_membership')
        .select('organizations(name)')
        .eq('user_id', userId!)
        .maybeSingle()
      const org = data?.organizations as { name?: string | null } | { name?: string | null }[] | null | undefined
      const name = (Array.isArray(org) ? org[0]?.name : org?.name)?.trim()
      return name || null
    },
    enabled: ready && !!userId,
    staleTime: Infinity,
  })
  return orgName ? `${orgName} View` : FALLBACK
}
