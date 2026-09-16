import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listContacts, createContact, updateContact, deleteContact,
} from '@/lib/commandCenter/api'
import type { Contact, ContactWithRecency } from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'

/**
 * Contacts with their DERIVED last-met date. There is no stored `date_met` column --
 * it comes from the most recent logged interaction tagging the contact, so it cannot
 * go stale when a meeting is back-dated or deleted.
 */
export function useContacts(coverageId: string | undefined) {
  const { ready } = useCommandCenterSession()
  return useQuery<ContactWithRecency[]>({
    queryKey: ccKeys.contacts(coverageId ?? ''),
    queryFn: () => listContacts(coverageId!),
    enabled: ready && !!coverageId,
    staleTime: 30_000,
  })
}

export function useSaveContact() {
  const qc = useQueryClient()
  return useMutation<
    Contact, Error,
    { id?: string; values: Parameters<typeof createContact>[0] & Partial<Contact> }
  >({
    mutationFn: ({ id, values }) => (id ? updateContact(id, values) : createContact(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ccKeys.all })
      toast.success('Contact saved')
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: deleteContact,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ccKeys.all })
      toast.success('Contact removed')
    },
    onError: (err) => toast.error(err.message),
  })
}
