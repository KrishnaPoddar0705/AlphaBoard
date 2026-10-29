import { useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CONNECTOR_BY_ID, SOURCE_LABELS } from '@/lib/commandCenter/boardSources'
import type { PendingPull } from './useConnectorPull'

/**
 * The board's one piece of theatre: when a connector fires, a cursor glides from where
 * the analyst clicked to the card being filled, labelled with the source it is reading.
 * It says "data is coming, from here, into there" without a spinner in sight.
 *
 * Purely decorative (aria-hidden), skipped under reduced motion, and keyed to the
 * pull, so a second pull mid-flight starts its own cursor.
 */
export default function GhostCursor({ pull }: { pull: PendingPull | null }) {
  const reduce = useReducedMotion()
  // Keyed by pull id, so a new pull never flies to the previous card's position.
  const [measured, setMeasured] = useState<{ id: string; x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!pull?.origin) return
    // The placeholder card mounts in the same commit; measure the visible copy of it.
    const raf = requestAnimationFrame(() => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-card="${pull.id}"]`)]
        .find((n) => n.offsetParent !== null)
      if (!el) return
      const r = el.getBoundingClientRect()
      setMeasured({ id: pull.id, x: r.left + Math.min(56, r.width / 3), y: r.top + 34 })
    })
    return () => cancelAnimationFrame(raf)
  }, [pull?.id, pull?.origin])

  if (reduce || !pull?.origin) return null
  const target = measured?.id === pull.id ? measured : null
  const def = CONNECTOR_BY_ID[pull.connector]
  const source = SOURCE_LABELS[def.sources[0]]

  return (
    <AnimatePresence>
      {target && pull.status === 'loading' && (
        <motion.div
          key={pull.id}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[70]"
          initial={{ x: pull.origin.x, y: pull.origin.y, opacity: 0 }}
          animate={{ x: target.x, y: target.y, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 0.9 }}
        >
          <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow-[0_4px_8px_rgba(28,27,23,0.35)]">
            <path d="M1.5 1.5 L16 10 L9.2 11.4 L6 18.2 Z" fill="#1C1B17" stroke="#FBF7ED" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <motion.span
            className="tb-data absolute left-4 top-4 whitespace-nowrap rounded-full bg-[#1C1B17] px-2 py-[3px] text-[10.5px] text-[#F7F2E6]"
            animate={{ opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            Reading {source}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
