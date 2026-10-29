import { useCallback, useRef, useState } from 'react'
import type { BoardCard, ConnectorId, SourcePayload } from '@/lib/commandCenter/boardTypes'
import { fetchSource } from '@/lib/commandCenter/boardSources'
import { track } from '@/lib/analytics'

export interface PendingPull {
  id: string
  connector: ConnectorId
  status: 'loading' | 'error'
  error?: string
  quarter?: string | null
  /** Where the ghost cursor starts: the rail button (or the caret, for a slash pull). */
  origin: { x: number; y: number } | null
  /** Set for slash-command pulls: the result goes straight into the doc at this position. */
  insertAt?: number
  /** Refreshing an existing card: the result replaces the card with this id. */
  replaceId?: string
}

interface Options {
  ticker: string | null
  onResolved: (card: BoardCard, opts: { insertAt?: number; replaceId?: string }) => void
}

/**
 * Runs connector pulls for one note. A pull shows up at once as a placeholder card (so
 * the ghost cursor has somewhere to fly), then resolves into a real card or an error
 * with a retry. Several can be in flight together; each is aborted if the note closes.
 */
export function useConnectorPull({ ticker, onResolved }: Options) {
  const [pending, setPending] = useState<PendingPull[]>([])
  const controllers = useRef(new Map<string, AbortController>())
  const resolvedRef = useRef(onResolved)
  resolvedRef.current = onResolved

  const run = useCallback(async (p: PendingPull) => {
    if (!ticker) return
    const ctrl = new AbortController()
    controllers.current.set(p.id, ctrl)
    try {
      const payload: SourcePayload = await fetchSource({ connector: p.connector, ticker, quarter: p.quarter }, ctrl.signal)
      if (ctrl.signal.aborted) return
      setPending((list) => list.filter((x) => x.id !== p.id))
      resolvedRef.current(
        { id: p.replaceId ?? p.id, payload, side: 'right', quarter: p.quarter ?? null },
        { insertAt: p.insertAt, replaceId: p.replaceId },
      )
      track('cc_board_source_pulled', { connector: p.connector, source: payload.source, ticker })
    } catch (err) {
      if (ctrl.signal.aborted) return
      const message = err instanceof Error ? err.message : 'The data source failed.'
      setPending((list) => list.map((x) => (x.id === p.id ? { ...x, status: 'error', error: message } : x)))
    } finally {
      controllers.current.delete(p.id)
    }
  }, [ticker])

  const pull = useCallback((connector: ConnectorId, opts: {
    origin?: { x: number; y: number } | null; insertAt?: number; quarter?: string | null; replaceId?: string
  } = {}) => {
    const p: PendingPull = {
      id: crypto.randomUUID(), connector, status: 'loading',
      origin: opts.origin ?? null, insertAt: opts.insertAt, quarter: opts.quarter ?? null, replaceId: opts.replaceId,
    }
    setPending((list) => [p, ...list])
    void run(p)
    return p.id
  }, [run])

  // Read from a ref, not inside a setState updater: StrictMode runs updaters twice,
  // which would fire every retry twice.
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  const retry = useCallback((id: string) => {
    const p = pendingRef.current.find((x) => x.id === id)
    if (!p) return
    const next: PendingPull = { ...p, status: 'loading', error: undefined, origin: null }
    setPending((list) => list.map((x) => (x.id === id ? next : x)))
    void run(next)
  }, [run])

  const dismiss = useCallback((id: string) => {
    controllers.current.get(id)?.abort()
    setPending((list) => list.filter((x) => x.id !== id))
  }, [])

  const abortAll = useCallback(() => {
    controllers.current.forEach((c) => c.abort())
    controllers.current.clear()
    setPending([])
  }, [])

  return { pending, pull, retry, dismiss, abortAll }
}
