import { useCallback, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ThesisEditor from '@/components/thesis/ThesisEditor'
import FileDropzone from '@/components/recommendations/FileDropzone'
import { extractFiles, nameClipboardFiles } from '@/lib/recommendations/clipboardFiles'
import { useAttachmentUploads } from '@/hooks/useAttachmentUploads'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { useBrokers } from '@/hooks/commandCenter/useBrokers'
import { useContacts } from '@/hooks/commandCenter/useContacts'
import { useCreateEvent } from '@/hooks/commandCenter/useCommandCenterEvents'
import { createContact } from '@/lib/commandCenter/api'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import {
  uploadCommandCenterFile, deleteCommandCenterFile, deleteCommandCenterFiles,
  validateAttachment as validateCcAttachment,
} from '@/lib/commandCenter/attachments'
import { CC_MAX_FILES, EVENT_TYPES } from '@/lib/commandCenter/constants'
import { today, formatDay } from '@/lib/commandCenter/format'
import { latestCompletedKey, periodLabels } from '@/lib/commandCenter/periods'
import type { EventTypeOption } from '@/lib/commandCenter/constants'
import EventTypePicker from './EventTypePicker'
import CoveragePicker from './CoveragePicker'
import EventDetailFields, { type DetailValues } from './EventDetailFields'
import EventContactsField from './EventContactsField'

const EMPTY_DETAILS: DetailValues = {
  brokerId: null, thesisImpact: null, openQuestions: '', periodLabel: '', contactIds: [], newContacts: [],
  reviewRequested: false, reviewNote: '',
}

const labelClass = 'font-mono text-[11px] uppercase tracking-wider text-[#6F6A60]'

interface Props {
  open: boolean
  onClose: () => void
  /** Pre-selects a stock when opened from that stock's page. */
  coverageId?: string
  /** Pre-selects what happened, by EVENT_TYPES id (e.g. from a concall cell). */
  initialTypeId?: string
  /** Pre-selects the period, e.g. "Q1 FY27". */
  initialPeriod?: string
  /** Opens in "Upcoming" mode, for booking a concall that has not happened yet. */
  initialScheduled?: boolean
}

/**
 * The quick-capture flow: pick a stock, pick what happened, dump the takeaways, save.
 *
 * This is the whole product. If logging a meeting is slower than typing it into a
 * Google Doc, nobody will use any of the rest. So: stock and type are one tap each,
 * the date defaults to today, and the takeaways box accepts whatever is on the
 * clipboard -- a spreadsheet range becomes a table, a screenshot becomes an attachment.
 */
export default function LogEventSheet({
  open, onClose, coverageId, initialTypeId, initialPeriod, initialScheduled,
}: Props) {
  const { userId, organizationId, ready } = useCommandCenterSession()
  const { data: coverage = [] } = useCoverageBoard()
  const { data: brokers = [] } = useBrokers()
  const createEvent = useCreateEvent()

  const [selectedCoverage, setSelectedCoverage] = useState<string | null>(coverageId ?? null)
  const [type, setType] = useState<EventTypeOption | null>(
    () => EVENT_TYPES.find((t) => t.id === initialTypeId) ?? null
  )
  // null until the analyst types their own; the generated title is used until then.
  const [titleOverride, setTitleOverride] = useState<string | null>(null)
  const [eventDate, setEventDate] = useState(today())
  const [isScheduled, setIsScheduled] = useState(!!initialScheduled)
  const [kta, setKta] = useState('')
  const [details, setDetails] = useState<DetailValues>(
    () => ({ ...EMPTY_DETAILS, periodLabel: initialPeriod ?? '' })
  )
  const [saving, setSaving] = useState(false)

  const { data: contacts = [], isPending: contactsPending } = useContacts(selectedCoverage ?? undefined)

  // Minted up front so uploads can run in the background, straight into their final
  // storage folder, while the analyst is still typing. The event row is then inserted
  // with this explicit id. The parent remounts this component on each open, so one
  // draft gets exactly one id.
  const eventIdRef = useRef<string>(crypto.randomUUID())
  // Contacts created by this draft. Kept so a retry after a failed save still tags them,
  // before the cached contact list has caught up.
  const createdContactIdsRef = useRef<string[]>([])

  const attachments = useAttachmentUploads({
    ticker: '',                       // unused: the CC path is built from ids, not tickers
    userId: selectedCoverage ? userId : null,
    // The storage context is assembled when a file is actually uploaded, not during
    // render -- reading eventIdRef here rather than in a useMemo keeps render pure and
    // guarantees the id is the current draft's, not one captured a render ago.
    upload: useCallback(
      (file: File) => uploadCommandCenterFile(file, {
        organizationId,
        userId: userId ?? '',
        coverageId: selectedCoverage ?? '',
        eventId: eventIdRef.current,
      }),
      [organizationId, userId, selectedCoverage]
    ),
    deleteFile: deleteCommandCenterFile,
    validate: validateCcAttachment,
    maxFiles: CC_MAX_FILES,
  })

  const { items: attachmentItems } = attachments

  // Files already in storage for a draft that is being abandoned. Cleaned up rather
  // than left as orphans nobody will ever find.
  const discardUploads = useCallback(() => {
    const keys = attachmentItems.filter((i) => i.key).map((i) => i.key!)
    if (keys.length > 0) void deleteCommandCenterFiles(keys)
  }, [attachmentItems])

  const periodOptions = useMemo(() => {
    if (!type) return []
    // Two periods ahead so an upcoming call can be booked, then the recent history.
    const kind = type.kind === 'annual_report' || type.kind === 'agm' ? 'annual_report' : 'concall'
    const latest = latestCompletedKey(kind)
    const options = periodLabels(kind, latest + 2, latest - (kind === 'concall' ? 7 : 5))
    // A period picked from the tracker's older history is not in the default window.
    if (initialPeriod && !options.includes(initialPeriod)) options.push(initialPeriod)
    return options
  }, [type, initialPeriod])

  // Derived, not stored: a sensible default title means the analyst almost never has to
  // write one, and computing it during render (rather than syncing it in an effect)
  // means it keeps up with the type and period without a second render pass.
  const suggestedTitle = useMemo(() => {
    if (!type) return ''
    const stock = coverage.find((c) => c.id === selectedCoverage)
    const suffix = details.periodLabel ? ` ${details.periodLabel}` : ''
    return `${type.label}${suffix}${stock ? ` -- ${stock.ticker}` : ''}`
  }, [type, selectedCoverage, details.periodLabel, coverage])

  const title = titleOverride ?? suggestedTitle

  const handlePaste = (e: React.ClipboardEvent) => {
    // ThesisEditor already consumed it (a spreadsheet range became a table), or there
    // is nothing to attach. preventDefault does not stop propagation, and Excel puts a
    // bitmap of the copied range alongside the HTML -- without this guard, pasting a
    // sheet would insert the table AND attach a screenshot of it.
    if (e.defaultPrevented || !selectedCoverage) return
    const files = extractFiles(e.clipboardData)
    if (files.length === 0) return
    e.preventDefault()
    attachments.addFiles(nameClipboardFiles(files))
  }

  const canSave =
    ready && !!selectedCoverage && !!type && !!title.trim() &&
    attachments.pendingCount === 0 && !saving

  // Reports are read, not attended -- there is nobody to tag.
  const wantsContacts = !!type && type.kind !== 'annual_report' && type.kind !== 'broker_report'

  const save = async () => {
    if (!selectedCoverage || !type) return
    setSaving(true)

    // New people become contacts on the stock first, so the entry can tag them. Tagged
    // ids are re-checked against the current stock's contacts in case the stock changed
    // after they were picked.
    let contactIds: string[] = []
    if (wantsContacts) {
      const onStock = new Set([...contacts.map((c) => c.id), ...createdContactIdsRef.current])
      contactIds = details.contactIds.filter((id) => onStock.has(id))
      const savedDrafts = new Set<string>()
      // Drafts that became real contacts leave the draft list either way, so a retry
      // never creates the same person twice.
      const settle = () => {
        if (savedDrafts.size === 0) return
        const ids = [...contactIds]
        setDetails((d) => ({
          ...d,
          contactIds: ids,
          newContacts: d.newContacts.filter((x) => !savedDrafts.has(x.draftId)),
        }))
      }
      try {
        for (const draft of details.newContacts) {
          const created = await createContact({ ...draft, coverage_id: selectedCoverage })
          contactIds.push(created.id)
          createdContactIdsRef.current.push(created.id)
          savedDrafts.add(draft.draftId)
        }
      } catch (err) {
        settle()
        toast.error(err instanceof Error ? err.message : 'Could not save a new contact')
        setSaving(false)
        return
      }
      settle()
    }

    try {
      await createEvent.mutateAsync({
        id: eventIdRef.current,
        coverage_id: selectedCoverage,
        kind: type.kind,
        subtype: type.subtype,
        title: title.trim(),
        event_date: eventDate,
        is_scheduled: isScheduled,
        // A scheduled item has not happened, so "attended" cannot be yes yet.
        attendance: isScheduled ? 'na' : type.wantsAttendance ? 'yes' : 'na',
        period_label: details.periodLabel || null,
        broker_id: details.brokerId,
        kta: kta || null,
        thesis_impact: details.thesisImpact,
        open_questions: details.openQuestions || null,
        analyst_id: userId,
        contact_ids: contactIds,
        // A plan is not reviewable yet; only logged work goes to the PM.
        review_requested: !isScheduled && details.reviewRequested,
        review_note: details.reviewNote || null,
        attachments: attachments.items
          .filter((i) => i.status === 'done' && i.key)
          .map((i) => ({
            storage_path: i.key!,
            external_url: null,
            file_name: i.name,
            mime_type: i.mime ?? null,
            size_bytes: i.size,
          })),
      })
      toast.success(isScheduled ? 'Added to the calendar' : 'Logged')
      onClose()
    } catch {
      // useCreateEvent already surfaced the reason; keep the sheet open with the draft.
      setSaving(false)
    }
  }

  const close = () => {
    if (!saving) discardUploads()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent
        onPaste={handlePaste}
        // Full screen on a phone; a centred, scrolling modal from sm up. Only the body
        // scrolls, so the title and the Save bar stay put.
        className="flex h-[100dvh] max-h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl"
      >
        <DialogHeader className="border-b border-[#E3DDCF] px-5 py-4 text-left">
          <DialogTitle className="font-mono text-base">Log an interaction</DialogTitle>
          <DialogDescription className="sr-only">
            Record a meeting, call or report against a stock.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Stock</span>
            <CoveragePicker
              coverage={coverage}
              value={selectedCoverage}
              onChange={(id) => setSelectedCoverage(id || null)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>What happened</span>
            <EventTypePicker value={type} onChange={setType} />
          </div>

          {type && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>When</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: 'Today', value: today(), scheduled: false },
                    { label: 'Yesterday', value: addDay(-1), scheduled: false },
                  ].map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => { setEventDate(d.value); setIsScheduled(false) }}
                      className={[
                        'rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
                        eventDate === d.value && !isScheduled
                          ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
                          : 'border-[#D7D0C2] bg-[#FBF7ED] text-[#1C1B17] hover:bg-[rgba(28,27,23,0.04)]',
                      ].join(' ')}
                    >
                      {d.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1.5 font-mono text-[11px] text-[#1C1B17] focus:outline-none"
                  />
                  <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-[#6F6A60]">
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#1C1B17]"
                    />
                    Upcoming
                  </label>
                </div>
                {isScheduled && (
                  <p className="font-mono text-[10px] text-[#8B857A]">
                    Goes on the calendar for {formatDay(eventDate)} instead of the log.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  className="w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-2 font-mono text-sm text-[#1C1B17] focus:border-[#8B857A] focus:outline-none"
                />
              </div>

              {wantsContacts && (
                <EventContactsField
                  contacts={contacts}
                  selectedIds={details.contactIds}
                  onSelectedIds={(contactIds) => setDetails((d) => ({ ...d, contactIds }))}
                  drafts={details.newContacts}
                  onDrafts={(newContacts) => setDetails((d) => ({ ...d, newContacts }))}
                  disabled={!selectedCoverage}
                  loading={!!selectedCoverage && contactsPending}
                />
              )}

              <EventDetailFields
                values={details}
                onChange={setDetails}
                brokers={brokers}
                wantsBroker={!!type.wantsBroker}
                wantsPeriod={!!type.wantsPeriod}
                periodOptions={periodOptions}
              />

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Key takeaways</span>
                <ThesisEditor
                  value={kta}
                  onChange={setKta}
                  onFiles={selectedCoverage ? attachments.addFiles : undefined}
                  rows={6}
                  placeholder="What did you learn? Paste a spreadsheet range to insert a table, or a screenshot to attach it."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Attachments</span>
                <FileDropzone
                  items={attachments.items}
                  onFiles={attachments.addFiles}
                  onRemove={attachments.remove}
                  onRetry={attachments.retry}
                  disabled={!selectedCoverage || !userId}
                  inputId="cc-log-files"
                  hint={selectedCoverage
                    ? `PDFs, images, spreadsheets and docs, up to 50 MB each, ${CC_MAX_FILES} max`
                    : 'Pick a stock first'}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#D7D0C2] bg-[#FBF7ED] px-5 py-3">
          <span className="font-mono text-[11px] text-[#6F6A60]">
            {attachments.pendingCount > 0
              ? `Uploading ${attachments.pendingCount}...`
              : attachments.failedCount > 0
                ? `${attachments.failedCount} upload failed`
                : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={close} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={!canSave}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function addDay(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
