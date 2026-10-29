import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { EVENT_TYPES, THESIS_IMPACTS, eventTypeOf, type EventTypeOption } from '@/lib/commandCenter/constants'
import { latestCompletedKey, periodLabels } from '@/lib/commandCenter/periods'
import { today } from '@/lib/commandCenter/format'
import type { ThesisImpact } from '@/lib/commandCenter/types'
import type { Board } from '@/lib/commandCenter/boardTypes'
import { BOARD_MARKER } from '@/lib/commandCenter/boardFormat'
import { getPublishedEntry, updateBoard } from '@/lib/commandCenter/boards'
import { useCreateEvent, useUpdateEvent } from '@/hooks/commandCenter/useCommandCenterEvents'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { ccKeys } from '@/hooks/commandCenter/useCoverage'
import { track } from '@/lib/analytics'
import EventTypePicker from '../entry/EventTypePicker'
import SvanViewField, { type SvanValues } from '../entry/SvanViewField'

interface Props {
  open: boolean
  onClose: () => void
  boardId: string
  coverageId: string
  ticker: string
  noteTitle: string
  publishedEventId: string | null
  /** Called at publish time so the latest keystrokes are in the entry. */
  getMarkdown: () => string
  words: number
  blocks: number
  onPublished: (eventId: string) => void
}

const label = 'font-mono text-[11px] text-[#6F6A60]'
const input = 'w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-1.5 font-mono text-xs text-[#1C1B17] focus:border-[#8B857A] focus:outline-none'

/**
 * Turns the note into an entry on the stock's log. The analyst picks what kind of work
 * it was, exactly as in the Log sheet; the note body becomes the key takeaways. The
 * board remembers the entry, so publishing again updates it instead of logging twice.
 */
export default function PublishToLogDialog({
  open, onClose, boardId, coverageId, ticker, noteTitle, publishedEventId, getMarkdown, words, blocks, onPublished,
}: Props) {
  const qc = useQueryClient()
  const { userId } = useCommandCenterSession()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()

  const [type, setType] = useState<EventTypeOption | null>(() => EVENT_TYPES.find((t) => t.id === 'other') ?? null)
  const [title, setTitle] = useState(noteTitle)
  const [eventDate, setEventDate] = useState(today())
  const [period, setPeriod] = useState('')
  const [impact, setImpact] = useState<ThesisImpact | null>(null)
  const [svan, setSvan] = useState<SvanValues>({ rating: null, view: '' })
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-publishing: start from what the entry says now, so nothing is silently reset.
  useEffect(() => {
    if (!open) return
    setTitle(noteTitle)
    if (!publishedEventId) return
    let live = true
    setLoadingEntry(true)
    getPublishedEntry(publishedEventId)
      .then((e) => {
        if (!live || !e) return
        setType(eventTypeOf(e.kind, e.subtype))
        setTitle(e.title)
        setEventDate(e.event_date)
        setPeriod(e.period_label ?? '')
        setImpact(e.thesis_impact)
        setSvan({ rating: e.svan_rating ?? null, view: e.svan_view ?? '' })
      })
      .catch(() => undefined)
      .finally(() => { if (live) setLoadingEntry(false) })
    return () => { live = false }
  }, [open, publishedEventId, noteTitle])

  const periodOptions = useMemo(() => {
    if (!type?.wantsPeriod) return []
    const kind = type.kind === 'annual_report' || type.kind === 'agm' ? 'annual_report' : 'concall'
    const latest = latestCompletedKey(kind)
    return periodLabels(kind, latest + 1, latest - (kind === 'concall' ? 7 : 5))
  }, [type])

  const republish = !!publishedEventId
  const canPublish = !!type && !!title.trim() && words + blocks > 0 && !saving && !loadingEntry

  const publish = async () => {
    if (!type) return
    setSaving(true)
    const body = getMarkdown()
    const kta = body ? `${BOARD_MARKER}\n\n${body}` : ''
    const fields = {
      kind: type.kind,
      subtype: type.subtype,
      title: title.trim(),
      event_date: eventDate,
      period_label: type.wantsPeriod && period ? period : null,
      thesis_impact: impact,
      kta: kta || null,
      ...(svan.rating || svan.view.trim() ? { svan_rating: svan.rating, svan_view: svan.view.trim() || null } : {}),
    }
    try {
      let eventId = publishedEventId
      if (republish && eventId) {
        await updateEvent.mutateAsync({ id: eventId, patch: fields })
      } else {
        eventId = crypto.randomUUID()
        await createEvent.mutateAsync({
          ...fields, id: eventId, coverage_id: coverageId, is_scheduled: false,
          attendance: type.wantsAttendance ? 'yes' : 'na', analyst_id: userId,
        })
      }
      const link = { published_event_id: eventId, last_published_at: new Date().toISOString() }
      await updateBoard(boardId, link)
      // The open note's cache never refetches; without this, reopening the note would
      // forget its entry and the next publish would log a duplicate.
      qc.setQueryData<Board | null>(ccKeys.boardDoc(boardId), (prev) => (prev ? { ...prev, ...link } : prev))
      qc.invalidateQueries({ queryKey: ccKeys.boardTree() })
      track('cc_board_published', { kind: type.kind, republish, words, blocks })
      toast.success(republish ? `Updated in the ${ticker} log` : `Published to the ${ticker} log`)
      onPublished(eventId!)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-[#D7D0C2] bg-[#F7F2E6] sm:max-w-xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="font-mono text-base text-[#1C1B17]">
            {republish ? 'Update the log entry' : `Publish to the ${ticker} log`}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] text-[#6F6A60]">
            The note becomes the entry's key takeaways: {words.toLocaleString('en-IN')} words
            {blocks > 0 ? ` and ${blocks} data ${blocks === 1 ? 'block' : 'blocks'}, as tables with their sources` : ''}.
          </DialogDescription>
        </DialogHeader>

        {loadingEntry ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#8B857A]" /></div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className={label}>What was this work?</span>
              <EventTypePicker value={type} onChange={(t) => { setType(t); if (!t.wantsPeriod) setPeriod('') }} />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={label}>Title</span>
              <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={label}>Date</span>
                <input type="date" className={input} value={eventDate} max={today()} onChange={(e) => setEventDate(e.target.value)} />
              </label>
              {periodOptions.length > 0 && (
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Period</span>
                  <select className={input} value={period} onChange={(e) => setPeriod(e.target.value)}>
                    <option value="">None</option>
                    {periodOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={label}>Effect on the thesis</span>
              <div className="flex gap-1.5">
                {THESIS_IMPACTS.map((t) => (
                  <button key={t.value} type="button" aria-pressed={impact === t.value}
                    onClick={() => setImpact(impact === t.value ? null : t.value)}
                    className="flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs transition-colors"
                    style={impact === t.value
                      ? { borderColor: t.color, color: t.color, background: `${t.color}14` }
                      : { borderColor: '#D7D0C2', color: '#6F6A60' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <SvanViewField values={svan} onChange={setSvan} />
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={publish} disabled={!canPublish}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {republish ? 'Update entry' : 'Publish'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
