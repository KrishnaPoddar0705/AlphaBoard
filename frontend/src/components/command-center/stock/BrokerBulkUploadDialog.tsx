import { useCallback, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ThesisEditor from '@/components/thesis/ThesisEditor'
import { useBrokers } from '@/hooks/commandCenter/useBrokers'
import { useCreateEvent } from '@/hooks/commandCenter/useCommandCenterEvents'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { deleteCommandCenterFiles } from '@/lib/commandCenter/attachments'
import { today } from '@/lib/commandCenter/format'
import { recentQuarters, formatQuarterLabel } from '@/lib/commandCenter/periods'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'
import BrokerUploadRow, { type PendingAttachment } from './BrokerUploadRow'

interface Props {
  open: boolean
  onClose: () => void
  coverage: CoverageBoardRow
}

const fieldClass =
  'rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1 font-mono text-xs text-[#1C1B17] focus:outline-none'

/**
 * Logs research from several brokers in one pass.
 *
 * Tick the brokers, drop each one's note, write the takeaways once. Each ticked broker
 * becomes its own `broker_report` entry -- so the timeline and the broker grid stay
 * accurate -- but the analyst fills the form once instead of eight times.
 *
 * The parent gives this a `key` that changes each time it opens, so a fresh draft is a
 * fresh mount rather than a dozen setState calls in an effect.
 */
export default function BrokerBulkUploadDialog({ open, onClose, coverage }: Props) {
  const { data: brokers = [] } = useBrokers()
  const { userId, organizationId } = useCommandCenterSession()
  const createEvent = useCreateEvent()

  const [picked, setPicked] = useState<string[]>([])
  const [kta, setKta] = useState('')
  const [period, setPeriod] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  // One event id per broker, minted when it is ticked, so that broker's files upload
  // straight into that entry's own storage folder. State rather than a ref: it is read
  // during render to build each row's storage context, and refs must not be.
  const [eventIds, setEventIds] = useState<Record<string, string>>({})
  // Finished uploads, reported up by each BrokerUploadRow. A ref, not state: these
  // change on every upload and only matter at submit time.
  const filesByBroker = useRef<Record<string, PendingAttachment[]>>({})

  const periods = useMemo(() => recentQuarters(6).map(formatQuarterLabel), [])

  const toggle = (brokerId: string) => {
    setEventIds((prev) => (prev[brokerId] ? prev : { ...prev, [brokerId]: crypto.randomUUID() }))
    setPicked((prev) =>
      prev.includes(brokerId) ? prev.filter((id) => id !== brokerId) : [...prev, brokerId]
    )
  }

  // Stable identities: BrokerUploadRow calls these from effects, so a new function each
  // render would loop.
  const handleFiles = useCallback((brokerId: string, files: PendingAttachment[]) => {
    filesByBroker.current[brokerId] = files
  }, [])

  const handleDiscard = useCallback((keys: string[]) => {
    void deleteCommandCenterFiles(keys)
  }, [])

  const submit = async () => {
    if (picked.length === 0) return
    setSaving(true)
    let saved = 0
    for (const brokerId of picked) {
      const broker = brokers.find((b) => b.id === brokerId)
      try {
        await createEvent.mutateAsync({
          id: eventIds[brokerId],
          coverage_id: coverage.id,
          kind: 'broker_report',
          title: `${broker?.name ?? 'Broker'} note${period ? ` ${period}` : ''} -- ${coverage.ticker}`,
          event_date: date,
          period_label: period || null,
          broker_id: brokerId,
          kta: kta || null,
          analyst_id: userId,
          attachments: filesByBroker.current[brokerId] ?? [],
        })
        saved += 1
        // Saved files are no longer orphans, so the unmount cleanup must not delete them.
        delete filesByBroker.current[brokerId]
      } catch {
        // Reported by the mutation; keep going so one failure does not lose the rest.
      }
    }
    setSaving(false)
    if (saved > 0) toast.success(`Logged ${saved} broker ${saved === 1 ? 'note' : 'notes'}`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Broker research</DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#6F6A60]">
            Tick every broker whose note you are logging. Each becomes its own entry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {brokers.map((b) => {
              const on = picked.includes(b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggle(b.id)}
                  aria-pressed={on}
                  className={[
                    'rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
                    on
                      ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
                      : 'border-[#D7D0C2] bg-[#FBF7ED] text-[#1C1B17] hover:bg-[rgba(28,27,23,0.04)]',
                  ].join(' ')}
                >
                  {b.name}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-[#6F6A60]">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                     className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-[#6F6A60]">Period</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className={fieldClass}>
                <option value="">Not specified</option>
                {periods.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          {picked.map((brokerId) => {
            const broker = brokers.find((b) => b.id === brokerId)
            if (!broker || !userId || !eventIds[brokerId]) return null
            return (
              <BrokerUploadRow
                key={brokerId}
                brokerId={brokerId}
                brokerName={broker.name}
                ctx={{
                  organizationId,
                  userId,
                  coverageId: coverage.id,
                  eventId: eventIds[brokerId],
                }}
                onChange={handleFiles}
                onDiscard={handleDiscard}
              />
            )
          })}

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#6F6A60]">
              Key takeaways
            </span>
            <ThesisEditor
              value={kta}
              onChange={setKta}
              rows={5}
              placeholder="What do the notes say? Applies to every broker ticked above."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={picked.length === 0 || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Log {picked.length || ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
