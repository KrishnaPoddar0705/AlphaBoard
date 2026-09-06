import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { AttachmentItem } from '@/lib/recommendations/attachments'
import {
  MAX_FILES,
  deleteAttachment,
  uploadAttachment,
  validateAttachment,
} from '@/lib/recommendations/attachments'

interface Options {
  /** Empty until a stock is picked; uploads fall back to an "_unassigned" folder. */
  ticker: string
  /** Supabase user id. Uploads are disabled until this resolves. */
  userId: string | null
  /** Attachments already persisted on the recommendation, for the count cap. */
  existingCount?: number
  /** Fired once each time the queue drains, with every successfully uploaded URL. */
  onAllSettled?: (urls: string[]) => void
}

let idCounter = 0
const nextId = () => `att_${Date.now()}_${idCounter++}`

/**
 * Owns the lifecycle of files attached to a recommendation.
 *
 * Uploads start the moment a file arrives rather than at submit time. The old
 * flow awaited each file in series inside handleSubmit, so the Create button
 * blocked on every round-trip, and a failure was dropped on the floor because
 * the `if (!uploadError)` had no else-branch. Here each file is its own
 * promise, failures land in the item's state with a retry, and the caller can
 * see what is still in flight.
 *
 * Everything that is not a state transition -- toasts, upload kick-off, the
 * settled callback -- happens outside the setState updaters, which React
 * invokes twice under StrictMode.
 */
export function useAttachmentUploads({ ticker, userId, existingCount = 0, onAllSettled }: Options) {
  const [items, setItems] = useState<AttachmentItem[]>([])

  // supabase-js `upload()` accepts no AbortSignal, so removing a file mid-flight
  // cannot cancel the request. We mark the id as dead, discard the result when
  // it lands, and delete the orphaned object.
  const removedIds = useRef<Set<string>>(new Set())
  // Files are held so a failed upload can be retried without re-picking them.
  const filesById = useRef<Map<string, File>>(new Map())

  // The ref is the source of truth, not a mirror of state: every mutation goes
  // through `commit`, which updates it and then renders from it. Assigning a
  // ref during render is what React's lint rule warns about, and it is also
  // genuinely wrong here -- two drops in the same tick would both read the
  // pre-drop list and each think there was room for ten more files.
  const itemsRef = useRef<AttachmentItem[]>([])

  const tickerRef = useRef(ticker)
  const userIdRef = useRef(userId)
  const onAllSettledRef = useRef(onAllSettled)
  useEffect(() => {
    tickerRef.current = ticker
    userIdRef.current = userId
    onAllSettledRef.current = onAllSettled
  })

  const commit = useCallback((update: (prev: AttachmentItem[]) => AttachmentItem[]) => {
    itemsRef.current = update(itemsRef.current)
    setItems(itemsRef.current)
  }, [])

  const pendingCount = useMemo(() => items.filter((i) => i.status === 'uploading').length, [items])
  const failedCount = useMemo(() => items.filter((i) => i.status === 'failed').length, [items])
  const uploadedUrls = useMemo(
    () => items.filter((i) => i.status === 'done' && i.url).map((i) => i.url!),
    [items]
  )

  // Fire onAllSettled on the transition into "nothing in flight", so a batch of
  // parallel uploads persists once rather than once per file. Persisting per
  // file against a stale prop is how the detail view would lose earlier URLs.
  const wasPending = useRef(false)
  useEffect(() => {
    if (pendingCount > 0) {
      wasPending.current = true
      return
    }
    if (wasPending.current) {
      wasPending.current = false
      if (uploadedUrls.length > 0) onAllSettledRef.current?.(uploadedUrls)
    }
  }, [pendingCount, uploadedUrls])

  const runUpload = useCallback(async (id: string, file: File) => {
    const uid = userIdRef.current
    if (!uid) {
      commit((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'failed', error: 'Not signed in' } : i))
      )
      toast.error('Still signing you in -- try that file again in a moment')
      return
    }

    try {
      const { url, key } = await uploadAttachment(file, { userId: uid, ticker: tickerRef.current })

      if (removedIds.current.has(id)) {
        removedIds.current.delete(id)
        void deleteAttachment(key)
        return
      }
      commit((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'done', url, key } : i)))
    } catch (err) {
      if (removedIds.current.has(id)) {
        removedIds.current.delete(id)
        return
      }
      const message = err instanceof Error ? err.message : 'Upload failed'
      commit((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'failed', error: message } : i))
      )
      toast.error(`Couldn't upload "${file.name}": ${message}`)
    }
  }, [commit])

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return

      // Validate against the ref, not state, so a second drop in the same tick
      // still sees the files from the first one.
      const accepted: Array<{ id: string; file: File; item: AttachmentItem }> = []
      let count = existingCount + itemsRef.current.length

      for (const file of incoming) {
        const error = validateAttachment(file, count)
        if (error) {
          toast.error(error)
          continue
        }
        const id = nextId()
        filesById.current.set(id, file)
        accepted.push({
          id,
          file,
          item: { id, name: file.name, size: file.size, status: 'uploading' },
        })
        count += 1
      }

      if (accepted.length === 0) return

      const newItems = accepted.map((a) => a.item)
      commit((prev) => [...prev, ...newItems])

      for (const { id, file } of accepted) void runUpload(id, file)
    },
    [existingCount, runUpload, commit]
  )

  const remove = useCallback((id: string) => {
    const target = itemsRef.current.find((i) => i.id === id)
    if (target?.status === 'uploading') removedIds.current.add(id)
    if (target?.status === 'done' && target.key) void deleteAttachment(target.key)
    filesById.current.delete(id)
    commit((prev) => prev.filter((i) => i.id !== id))
  }, [commit])

  const retry = useCallback(
    (id: string) => {
      const file = filesById.current.get(id)
      if (!file) return
      removedIds.current.delete(id)
      commit((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'uploading', error: undefined } : i))
      )
      void runUpload(id, file)
    },
    [runUpload, commit]
  )

  const reset = useCallback(() => {
    removedIds.current.clear()
    filesById.current.clear()
    wasPending.current = false
    commit(() => [])
  }, [commit])

  return {
    items,
    addFiles,
    remove,
    retry,
    reset,
    uploadedUrls,
    pendingCount,
    failedCount,
    canAddMore: existingCount + items.length < MAX_FILES,
  }
}
