import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { listBrokers, addBroker } from '@/lib/commandCenter/api'
import type { Broker } from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'

export function useBrokers() {
  const { ready } = useCommandCenterSession()
  return useQuery<Broker[]>({
    queryKey: ccKeys.brokers(),
    queryFn: listBrokers,
    enabled: ready,
    // The seeded list barely changes; re-fetching it on every broker grid render is
    // pure waste.
    staleTime: 10 * 60_000,
  })
}

export function useAddBroker() {
  const qc = useQueryClient()
  return useMutation<Broker, Error, string>({
    mutationFn: addBroker,
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ccKeys.brokers() })
      toast.success(`${b.name} added`)
    },
    onError: (err) => toast.error(err.message),
  })
}
