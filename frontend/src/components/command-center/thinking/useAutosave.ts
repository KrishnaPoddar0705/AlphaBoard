import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardPatch } from '@/lib/commandCenter/boards'
import { useSaveBoard } from '@/hooks/commandCenter/useBoards'

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

const DEBOUNCE_MS = 1200
const draftKey = (id: string) => `alphaboard-thinking-draft:${id}`

interface LocalDraft { patch: BoardPatch; at: number }

/** A crash guard only: the database is the source of truth. Storage can be unavailable. */
export function readLocalDraft(id: string, serverUpdatedAt: string): BoardPatch | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    if (!raw) return null
    const d = JSON.parse(raw) as LocalDraft
    return d.at > new Date(serverUpdatedAt).getTime() ? d.patch : null
  } catch {
    return null
  }
}

function writeLocalDraft(id: string, patch: BoardPatch | null) {
  try {
    if (patch) localStorage.setItem(draftKey(id), JSON.stringify({ patch, at: Date.now() }))
    else localStorage.removeItem(draftKey(id))
  } catch { /* private mode, quota -- the server save still runs */ }
}

/**
 * Debounced, coalescing autosave for one note. Every edit merges into a pending patch;
 * 1.2s of quiet sends it. Switching notes or closing the tab flushes what is pending,
 * and a local copy survives a crash between keystroke and save.
 */
export function useAutosave(boardId: string) {
  const save = useSaveBoard()
  const [status, setStatus] = useState<SaveStatus>('saved')
  const pending = useRef<BoardPatch>({})
  const timer = useRef<number | null>(null)
  const inFlight = useRef<Promise<unknown> | null>(null)
  const saveRef = useRef(save.mutateAsync)
  useEffect(() => { saveRef.current = save.mutateAsync }, [save.mutateAsync])

  const flush = useCallback(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null }
    const patch = pending.current
    if (!Object.keys(patch).length) return
    pending.current = {}
    setStatus('saving')
    // Saves run one at a time so an older body can never land after a newer one.
    if (inFlight.current) await inFlight.current.catch(() => undefined)
    const p = saveRef.current({ id: boardId, patch })
    inFlight.current = p
    try {
      await p
      if (!Object.keys(pending.current).length) {
        writeLocalDraft(boardId, null)
        setStatus('saved')
      }
    } catch {
      // Put it back so the next edit (or the retry) carries it.
      pending.current = { ...patch, ...pending.current }
      setStatus('error')
    } finally {
      if (inFlight.current === p) inFlight.current = null
    }
  }, [boardId])

  const schedule = useCallback((patch: BoardPatch) => {
    pending.current = { ...pending.current, ...patch }
    writeLocalDraft(boardId, pending.current)
    setStatus('unsaved')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void flush() }, DEBOUNCE_MS)
  }, [boardId, flush])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) { void flush(); e.preventDefault() }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
      void flush()   // switching notes: the outgoing note saves what it has
    }
  }, [flush])

  return { status, schedule, flush }
}
