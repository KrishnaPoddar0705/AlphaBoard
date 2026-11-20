import { useState } from 'react'
import { svanRatingOf } from '@/lib/commandCenter/constants'
import type { Brief } from '@/lib/commandCenter/types'
import { useBriefAudioUrl } from '@/hooks/commandCenter/useBriefs'
import { briefDateLabel } from './briefFormat'

const chip = 'rounded border border-[#D7D0C2] px-1.5 py-0.5 font-mono text-[10px] text-[#3A3830]'

/** The open brief: podcast, the bullets, and the counts they were written from. */
export default function BriefDetail({ brief }: { brief: Brief }) {
  const [transcript, setTranscript] = useState(false)
  const audio = useBriefAudioUrl(brief.audio_path)
  const { stats } = brief

  return (
    <article className="flex flex-col gap-3 border-t border-[#D7D0C2] px-3 py-3">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">
          {brief.kind === 'weekly' ? 'Weekly brief' : 'Daily brief'} · {briefDateLabel(brief)} ·{' '}
          {stats.entries} logs, {stats.companies} companies, {stats.analysts} analysts
        </p>
        {brief.headline && <h3 className="font-mono text-sm font-semibold text-[#1C1B17]">{brief.headline}</h3>}
      </header>

      {brief.audio_path && (
        <div className="flex flex-col gap-1">
          {audio.data ? (
            // key: a new brief swaps the source cleanly instead of keeping the old position.
            <audio key={audio.data} controls preload="none" src={audio.data} className="h-9 w-full" />
          ) : (
            <p className="font-mono text-[11px] text-[#8B857A]">
              {audio.isError ? audio.error.message : 'Loading the podcast…'}
            </p>
          )}
          {brief.script && brief.script.length > 0 && (
            <button
              type="button"
              onClick={() => setTranscript((v) => !v)}
              className="self-start font-mono text-[10px] text-[#6F6A60] hover:text-[#1C1B17]"
            >
              {transcript ? 'Hide transcript' : 'Read transcript'}
            </button>
          )}
          {transcript && (
            <ol className="flex flex-col gap-1 rounded-md bg-[#F1EEE0] px-3 py-2">
              {brief.script?.map((turn, i) => (
                <li key={i} className="font-mono text-[11px] leading-relaxed text-[#1C1B17]">
                  <span className="font-semibold text-[#D06030]">{turn.speaker}:</span> {turn.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {brief.bullets.map((b, i) => (
          <li key={i} className="flex gap-2 font-mono text-xs leading-relaxed text-[#1C1B17]">
            <span className="select-none text-[#D06030]">▸</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 md:flex-row md:gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">Log types</span>
          <div className="flex flex-wrap gap-1">
            {Object.entries(stats.by_type ?? {}).map(([label, n]) => (
              <span key={label} className={chip}>{label} <span className="tabular-nums">{n}</span></span>
            ))}
          </div>
        </div>
        {stats.views?.length > 0 && (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">House View</span>
            <div className="flex flex-wrap gap-1">
              {stats.views.map((v) => {
                const r = svanRatingOf(v.rating)
                return (
                  <span key={v.ticker} className={chip} title={`by ${v.analyst}`}>
                    {v.ticker}{' '}
                    <span className="rounded px-1 text-[#F7F2E6]" style={{ backgroundColor: r?.color ?? '#8B857A' }}>
                      {r?.label ?? v.rating}
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
