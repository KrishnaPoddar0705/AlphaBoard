import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCalendarEvents } from '@/hooks/commandCenter/useActivityFeed'
import { addMonths, gridRange, bucketByDay } from '@/lib/commandCenter/calendar'
import { formatMonth, today } from '@/lib/commandCenter/format'
import MonthGrid from './MonthGrid'
import DayAgenda from './DayAgenda'

/**
 * Month grid plus the selected day's agenda.
 *
 * Past entries render solid and scheduled ones hollow, so the calendar is both a record
 * and a plan -- which is what makes it worth opening daily rather than only after a
 * meeting.
 */
export default function CalendarView() {
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState<string>(today())

  const { from, to } = useMemo(() => gridRange(month), [month])
  const { data: rows = [], isPending } = useCalendarEvents(from, to)

  const selectedRows = useMemo(
    () => bucketByDay(rows).get(selected) ?? [],
    [rows, selected]
  )

  const goToday = () => {
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelected(today())
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month"
                  onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center font-mono text-sm text-[#1C1B17]">
            {formatMonth(month)}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Next month"
                  onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        </div>
      </div>

      {/* Grid above agenda on mobile (the grid collapses to dots); side by side once
          there is room for both. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MonthGrid month={month} rows={rows} selected={selected} onSelect={setSelected} />
        <DayAgenda day={selected} rows={selectedRows} loading={isPending} />
      </div>
    </div>
  )
}
