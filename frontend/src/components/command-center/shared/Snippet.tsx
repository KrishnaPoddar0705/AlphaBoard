import { Fragment } from 'react'

/**
 * Matches the StartSel/StopSel that `cc_search_events` passes to ts_headline: STX and
 * ETX. Written as escapes rather than literal bytes so they survive copy-paste, diffs
 * and code review.
 */
const START = '\u0002'
const STOP = '\u0003'

/**
 * Renders a search snippet with its matched terms highlighted.
 *
 * Deliberately NOT dangerouslySetInnerHTML. `ts_headline` does not HTML-escape the text
 * it wraps, so emitting `<mark>` from the database and rendering it as HTML would let
 * anyone who can write a KTA inject markup into every colleague's browser. The database
 * marks matches with two control characters instead, and everything between them
 * becomes a React text node -- escaped by React, with none of the note's own content
 * ever parsed as markup.
 */
export default function Snippet({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null

  // Split on STX; in each following part, everything up to the first ETX is a match.
  const parts = text.split(START)
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (i === 0) return <Fragment key={i}>{part}</Fragment>
        const stop = part.indexOf(STOP)
        if (stop === -1) return <Fragment key={i}>{part}</Fragment>
        return (
          <Fragment key={i}>
            <mark className="bg-[#F09070] text-[#1C1B17]">{part.slice(0, stop)}</mark>
            {part.slice(stop + 1)}
          </Fragment>
        )
      })}
    </span>
  )
}
