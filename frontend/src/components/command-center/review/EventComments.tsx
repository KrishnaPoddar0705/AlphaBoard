import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { RowsSkeleton } from '../shared/Skeleton'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { useAddComment, useComments, useDeleteComment } from '@/hooks/commandCenter/useHome'
import { relativeTime } from '@/lib/commandCenter/home'

/** The discussion under one entry: anyone who can see the entry can take part. */
export default function EventComments({ eventId }: { eventId: string }) {
  const { userId, role } = useCommandCenterSession()
  const { data: comments = [], isPending } = useComments(eventId)
  const add = useAddComment(eventId)
  const remove = useDeleteComment(eventId)
  const [body, setBody] = useState('')

  const submit = () => {
    if (!body.trim()) return
    add.mutate(body, { onSuccess: () => setBody('') })
  }

  return (
    <div className="flex flex-col gap-2">
      {isPending ? (
        <RowsSkeleton rows={2} />
      ) : comments.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-faint">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="group border-l-2 border-border-editorial pl-2">
              <div className="flex items-center gap-2 font-mono text-[10px] text-ink-muted">
                <span className="text-ink">{c.author_username ?? 'Unknown'}</span>
                <span>{relativeTime(c.created_at)}</span>
                {(c.author_id === userId || role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(c.id)}
                    aria-label="Delete comment"
                    className="ml-auto hidden text-ink-faint hover:text-negative group-hover:block"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap font-mono text-xs text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          rows={2}
          placeholder="Add a comment (Cmd+Enter to send)"
          className="min-w-0 flex-1 rounded border border-border-editorial bg-paper-alt px-2 py-1 font-mono text-[11px] text-ink focus:border-ink-faint focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || add.isPending}
          className="rounded border border-ink bg-ink px-2.5 py-1 font-mono text-[11px] text-paper-light disabled:opacity-40"
        >
          {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Post'}
        </button>
      </div>
    </div>
  )
}
