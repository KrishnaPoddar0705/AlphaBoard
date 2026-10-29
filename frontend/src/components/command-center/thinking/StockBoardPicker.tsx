import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { searchStocks, marketErrorMessage } from '@/lib/api'
import { useAddCoverage, useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import SectorPicker from '../shared/SectorPicker'

interface StockResult { symbol: string; name: string; market: string }

interface Props {
  open: boolean
  onClose: () => void
  /** The stock is in coverage (now, if it was just added); open a board for it. */
  onPicked: (coverageId: string) => void
}

const DEBOUNCE_MS = 250
const rowClass = 'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#EFE9DA] focus:bg-[#EFE9DA] focus:outline-none'

/**
 * One search box for "which stock is this board about?". Names already in coverage come
 * first and open straight away; anything else is added to coverage on the way in, since
 * a board's notes publish to that stock's log and a log needs a covered stock.
 */
export default function StockBoardPicker({ open, onClose, onPicked }: Props) {
  const { data: coverage = [] } = useCoverageBoard()
  const addCoverage = useAddCoverage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pending, setPending] = useState<StockResult | null>(null)
  const [sector, setSector] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) return
    setQuery(''); setResults([]); setPending(null); setSector(''); setSearchError(null)
    abortRef.current?.abort()
  }, [open])

  const q = query.trim().toLowerCase()
  const covered = useMemo(() => coverage.filter((c) =>
    !q || c.ticker.toLowerCase().includes(q) || (c.company_name ?? '').toLowerCase().includes(q)).slice(0, q ? 8 : 6),
  [coverage, q])
  const coveredTickers = useMemo(() => new Set(coverage.map((c) => c.ticker.toUpperCase())), [coverage])

  useEffect(() => {
    if (q.length < 2) { setResults([]); setSearching(false); return }
    const t = window.setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setSearching(true); setSearchError(null)
      try {
        const data: StockResult[] = await searchStocks(q, ctrl.signal)
        setResults(data.filter((r) => !coveredTickers.has(r.symbol.toUpperCase())).slice(0, 8))
      } catch (err) {
        const msg = marketErrorMessage(err)
        if (msg) setSearchError(msg)
      } finally {
        if (!ctrl.signal.aborted) setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [q, coveredTickers])

  const add = async () => {
    if (!pending || !sector) return
    const row = await addCoverage.mutateAsync({
      ticker: pending.symbol, company_name: pending.name, market: pending.market, sector,
    }).catch(() => null)
    if (row) onPicked(row.id)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-[#D7D0C2] bg-[#F7F2E6] sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="font-mono text-base text-[#1C1B17]">
            {pending ? `Add ${pending.symbol} to coverage` : 'Start a board'}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] text-[#6F6A60]">
            {pending
              ? 'Pick its sector. The desk filters by it, and the board publishes to this stock’s log.'
              : 'Pick the stock this research is about.'}
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <div className="flex flex-col gap-4">
            <SectorPicker value={sector} onChange={setSector} />
            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setPending(null)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button size="sm" onClick={add} disabled={!sector || addCoverage.isPending}>
                {addCoverage.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add and open board
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-3 focus-within:border-[#1C1B17]">
              <Search className="h-4 w-4 text-[#8B857A]" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ticker or company name"
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-[#1C1B17] placeholder:text-[#A39D90] focus:outline-none focus-visible:shadow-none" />
              {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B857A]" />}
            </label>

            <div className="max-h-[52vh] overflow-y-auto overflow-x-hidden">
              {covered.length > 0 && (
                <>
                  <p className="px-2.5 pb-1 font-mono text-[10.5px] text-[#8B857A]">In your coverage</p>
                  {covered.map((c) => (
                    <button key={c.id} type="button" className={rowClass} onClick={() => onPicked(c.id)}>
                      <span className="w-24 flex-none truncate font-mono text-[11.5px] font-medium text-[#1C1B17]">{c.ticker}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#3F3C35]">{c.company_name}</span>
                      <span className="max-w-[30%] flex-none truncate text-right font-mono text-[10px] text-[#8B857A]">{c.sector}</span>
                    </button>
                  ))}
                </>
              )}
              {results.length > 0 && (
                <>
                  <p className="px-2.5 pb-1 pt-3 font-mono text-[10.5px] text-[#8B857A]">Add to coverage</p>
                  {results.map((r) => (
                    <button key={r.symbol} type="button" className={rowClass} onClick={() => setPending(r)}>
                      <span className="w-24 flex-none truncate font-mono text-[11.5px] font-medium text-[#1C1B17]">{r.symbol}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#3F3C35]">{r.name}</span>
                      <span className="w-9 flex-none text-right font-mono text-[10px] text-[#8B857A]">{r.market}</span>
                    </button>
                  ))}
                </>
              )}
              {searchError && <p className="px-2.5 py-3 font-mono text-[11px] text-[#B23B2A]">{searchError}</p>}
              {!searching && !searchError && q.length >= 2 && !covered.length && !results.length && (
                <p className="px-2.5 py-6 text-center font-mono text-[11px] text-[#8B857A]">No stock matches “{query.trim()}”.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
