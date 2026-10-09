import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { searchStocks, marketErrorMessage } from '@/lib/api'
import { listWatchlistCandidates, type WatchlistCandidate } from '@/lib/commandCenter/api'
import { useAddCoverage } from '@/hooks/commandCenter/useCoverage'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import EmptyState from '../shared/EmptyState'
import SectorPicker from '../shared/SectorPicker'

const DEBOUNCE_MS = 250

interface StockResult { symbol: string; name: string; market: string }

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Adds stocks to the desk's coverage universe.
 *
 * Two ways in, because retyping forty tickers is exactly the friction this feature is
 * supposed to remove: search, or bulk-import from the personal Watchlist the analyst
 * already curates. Coverage stays a separate list -- a price-watch list is not a
 * research universe -- but importing makes the first day cheap.
 *
 * Either way a sector is asked for before anything is added: the desk filters by it, so
 * a stock without one is a stock that goes missing.
 */
export default function AddCoverageDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockResult[]>([])
  const [searching, setSearching] = useState(false)
  // A failed lookup must not render as "no matches" -- that reads as "this stock does
  // not exist", which sent people hunting for the wrong problem.
  const [searchError, setSearchError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<WatchlistCandidate[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  /** The search result chosen, waiting on its sector. */
  const [pending, setPending] = useState<StockResult | null>(null)
  const [sector, setSector] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const addCoverage = useAddCoverage()
  const { userId } = useCommandCenterSession()

  useEffect(() => {
    if (!open) {
      setQuery(''); setResults([]); setPicked(new Set()); setCandidates(null)
      setSearchError(null); setPending(null); setSector('')
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [open])

  // Debounced ticker search against the existing /market/search endpoint.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setResults([]); setSearchError(null); setSearching(false); return }

    setSearching(true)
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const data = await searchStocks(term, controller.signal)
        if (controller.signal.aborted) return
        setResults((data ?? []).slice(0, 8))
        setSearchError(null)
      } catch (err) {
        if (controller.signal.aborted) return
        // marketErrorMessage returns null for an abort, which is the normal case on
        // every keystroke and must stay silent.
        const message = marketErrorMessage(err)
        if (message) { setResults([]); setSearchError(message) }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  const loadWatchlist = async () => {
    if (candidates || !userId) return
    try {
      setCandidates(await listWatchlistCandidates(userId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read your watchlist')
      setCandidates([])
    }
  }

  const addOne = async (s: StockResult) => {
    if (!sector) return
    // Persist the exact symbol /market/search returned. A user-typed 'RELIANCE' and a
    // returned 'RELIANCE.NS' are two different covered names forever -- there is no
    // stocks master table to reconcile them.
    await addCoverage.mutateAsync({
      ticker: s.symbol, company_name: s.name, market: s.market, sector,
    }).catch(() => { /* the mutation already toasts */ })
    setQuery(''); setResults([]); setPending(null); setSector('')
  }

  const importPicked = async () => {
    if (picked.size === 0 || !sector) return
    setImporting(true)
    let added = 0
    for (const ticker of picked) {
      try {
        await addCoverage.mutateAsync({ ticker, sector })
        added += 1
      } catch {
        // Already-covered and permission failures are reported by the mutation; keep
        // going so one bad ticker does not abandon the rest of the import.
      }
    }
    setImporting(false)
    setPicked(new Set())
    if (added > 0) toast.success(`Added ${added} ${added === 1 ? 'stock' : 'stocks'}`)
    onClose()
  }

  const toggle = (ticker: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  const importable = (candidates ?? []).filter((c) => !c.alreadyCovered)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Add to coverage</DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#6F6A60]">
            Stocks your desk tracks and researches.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="search"
          onValueChange={(v) => { setPending(null); setSector(''); if (v === 'watchlist') loadWatchlist() }}
        >
          <TabsList className="h-8">
            <TabsTrigger value="search" className="text-xs">Search</TabsTrigger>
            <TabsTrigger value="watchlist" className="text-xs">From my watchlist</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-3">
            {pending ? (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="truncate font-mono text-sm text-[#1C1B17]">{pending.name}</p>
                  <p className="font-mono text-[11px] text-[#6F6A60]">{pending.symbol} · {pending.market}</p>
                </div>
                <p className="font-mono text-[11px] text-[#6F6A60]">
                  Sector <span className="text-[#B23B2A]">· required</span>
                </p>
                <SectorPicker value={sector} onChange={setSector} />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { setPending(null); setSector('') }}
                    className="font-mono text-[11px] text-[#6F6A60] underline-offset-2 hover:underline"
                  >
                    Back to search
                  </button>
                  <Button size="sm" onClick={() => addOne(pending)} disabled={!sector || addCoverage.isPending}>
                    {addCoverage.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Add to coverage
                  </Button>
                </div>
              </div>
            ) : (
            <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B857A]" />
              {searching && (
                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#8B857A]" />
              )}
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a company or ticker"
                className="w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] py-2 pl-9 pr-9 font-mono text-sm text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#8B857A] focus:outline-none"
              />
            </div>

            <ul className="mt-2 max-h-72 overflow-y-auto">
              {results.map((s) => (
                <li key={`${s.symbol}-${s.market}`}>
                  <button
                    type="button"
                    onClick={() => setPending(s)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[rgba(28,27,23,0.04)] disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-sm text-[#1C1B17]">{s.name}</span>
                      <span className="block font-mono text-[11px] text-[#6F6A60]">
                        {s.symbol} · {s.market}
                      </span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-[#6F6A60]" />
                  </button>
                </li>
              ))}
              {searchError && (
                <li className="rounded-lg border border-[#B23B2A] bg-[#FBF7ED] px-3 py-2">
                  <p className="font-mono text-[11px] text-[#B23B2A]">{searchError}</p>
                </li>
              )}
              {!searchError && query.trim().length >= 2 && !searching && results.length === 0 && (
                <EmptyState title="No matches" hint="Try the exchange suffix, e.g. RELIANCE.NS" />
              )}
            </ul>
            </>
            )}
          </TabsContent>

          <TabsContent value="watchlist" className="mt-3">
            {candidates === null ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#8B857A]" />
              </div>
            ) : importable.length === 0 ? (
              <EmptyState
                icon={Star}
                title="Nothing left to import"
                hint="Everything on your watchlist is already covered, or your watchlist is empty."
              />
            ) : (
              <>
                <ul className="max-h-64 overflow-y-auto">
                  {importable.map((c) => (
                    <li key={c.ticker}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[rgba(28,27,23,0.04)]">
                        <input
                          type="checkbox"
                          checked={picked.has(c.ticker)}
                          onChange={() => toggle(c.ticker)}
                          className="h-3.5 w-3.5 accent-[#1C1B17]"
                        />
                        <span className="font-mono text-sm text-[#1C1B17]">{c.ticker}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {picked.size > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <p className="font-mono text-[11px] text-[#6F6A60]">
                      Sector for {picked.size === 1 ? 'this stock' : `these ${picked.size} stocks`}{' '}
                      <span className="text-[#B23B2A]">· required</span>
                    </p>
                    <SectorPicker value={sector} onChange={setSector} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPicked(new Set(importable.map((c) => c.ticker)))}
                    className="font-mono text-[11px] text-[#6F6A60] underline-offset-2 hover:underline"
                  >
                    Select all {importable.length}
                  </button>
                  <Button size="sm" onClick={importPicked} disabled={picked.size === 0 || !sector || importing}>
                    {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Add {picked.size || ''}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
