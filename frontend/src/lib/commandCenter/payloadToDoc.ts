import type { SourcePayload } from './boardTypes'

/**
 * The analyst's changes to a pulled block: hidden sections and items, and reworded
 * bullets. Stored on the block (attrs.hiddenSections / hiddenItems / edits), so the
 * snapshot itself is never altered and every change can be undone.
 */
export interface Trim {
  hiddenSections?: string[]
  hiddenItems?: number[]
  /** Reworded bullets by editKey(); an empty string removes the bullet. */
  edits?: Record<string, string>
}

/**
 * Identifies one bullet in one section of a snapshot. '#' rather than a control
 * character: these keys are saved in a jsonb column, and Postgres rejects \u0000 there.
 */
export function editKey(heading: string, index: number): string {
  return `${heading}#${index}`
}

/** The payload as the analyst has shaped it -- the one place hiding and edits are applied. */
export function visiblePayload(p: SourcePayload, trim: Trim = {}): SourcePayload {
  const sections = new Set(trim.hiddenSections ?? [])
  const items = new Set(trim.hiddenItems ?? [])
  const edits = trim.edits ?? {}
  return {
    ...p,
    sections: p.sections?.filter((s) => !sections.has(s.heading)).map((s) => ({
      ...s,
      bullets: s.bullets
        .map((b, i) => edits[editKey(s.heading, i)] ?? b)
        .filter((b) => b.trim() !== ''),
    })) ?? null,
    items: p.items?.filter((_, i) => !items.has(i)) ?? null,
  }
}
