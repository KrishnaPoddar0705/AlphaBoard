import { createContext, useContext } from 'react'
import type { EventContactTag } from '@/lib/commandCenter/api'

type Met = EventContactTag['contact']

/**
 * For screens that render entries deep in a tree (the home panels): the screen loads
 * the names once and every entry line reads them from here.
 */
export const EventContactsContext = createContext<{
  byEvent: Map<string, Met[]>
  loading: boolean
}>({ byEvent: new Map(), loading: false })

export function useMetWith(eventId: string) {
  const { byEvent, loading } = useContext(EventContactsContext)
  return { contacts: byEvent.get(eventId), loading }
}
