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
        <p className="font-mono text-[11px] text-[#8B857A]">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="group border-l-2 border-[#D7D0C2] pl-2">
              <div className="flex items-center gap-2 font-mono text-[10px] text-[#6F6A60]">
                <span className="text-[#1C1B17]">{c.author_username ?? 'Unknown'}</span>
                <span>{relativeTime(c.created_at)}</span>
                {(c.author_id === userId || role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(c.id)}
                    aria-label="Delete comment"
                    className="ml-auto hidden text-[#8B857A] hover:text-[#B23B2A] group-hover:block"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap font-mono text-xs text-[#1C1B17]">{c.body}</p>
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
          className="min-w-0 flex-1 rounded border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1 font-mono text-[11px] text-[#1C1B17] focus:border-[#8B857A] focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || add.isPending}
          className="rounded border border-[#1C1B17] bg-[#1C1B17] px-2.5 py-1 font-mono text-[11px] text-[#F7F2E6] disabled:opacity-40"
        >
          {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Post'}
        </button>
      </div>
    </div>
  )
}
