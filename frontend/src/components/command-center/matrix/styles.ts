/**
 * Typography, control and table tokens for the Matrix, as class strings over the CSS
 * variables in matrix.css. One place to change a size or a weight, so every cell, header
 * and control stays in step.
 */

/** Type scale. Sans for the interface; mono only for tickers, dates, counts and ids. */
export const type = {
  pageTitle: 'text-[15px] font-semibold tracking-[-0.01em] text-(--mx-text)',
  name: 'text-[13px] font-medium leading-5 text-(--mx-text)',
  header: 'text-[11.5px] font-medium text-(--mx-text-3)',
  body: 'text-[12.5px] leading-[18px] text-(--mx-text)',
  meta: 'text-[11.5px] leading-4 text-(--mx-text-2)',
  help: 'text-[11px] leading-4 text-(--mx-text-3)',
  mono: 'font-mono text-[11px] tabular-nums text-(--mx-text-2)',
  monoFaint: 'font-mono text-[10.5px] tabular-nums text-(--mx-text-3)',
  label: 'text-[10.5px] font-medium uppercase tracking-[0.08em] text-(--mx-text-3)',
} as const

/** Controls: one height, one radius, one hover and focus language. */
export const control = {
  base: 'inline-flex h-(--mx-control-h) items-center gap-1.5 rounded-(--mx-radius) px-2.5 text-[12.5px] transition-colors duration-150 disabled:opacity-50',
  ghost: 'text-(--mx-text-2) hover:bg-(--mx-hover) hover:text-(--mx-text)',
  outline: 'border border-(--mx-line-strong) bg-(--mx-surface) text-(--mx-text) hover:bg-(--mx-hover)',
  primary: 'bg-(--mx-primary) text-(--mx-primary-text) hover:opacity-90',
  icon: 'inline-flex size-(--mx-control-h) items-center justify-center rounded-(--mx-radius) text-(--mx-text-2) transition-colors hover:bg-(--mx-hover) hover:text-(--mx-text)',
  /** A segmented group: the container and its on/off items. */
  segment: 'inline-flex items-center rounded-(--mx-radius) bg-(--mx-sunken) p-0.5 ring-1 ring-(--mx-line) ring-inset',
  segmentItem: 'inline-flex h-6 items-center gap-1.5 rounded-[5px] px-2 text-[12px] transition-colors duration-150',
  segmentOn: 'bg-(--mx-raised) text-(--mx-text) shadow-(--mx-shadow)',
  segmentOff: 'text-(--mx-text-2) hover:text-(--mx-text)',
} as const

/** Icon sizes. */
export const icon = { sm: 'size-3', md: 'size-3.5', lg: 'size-4' } as const

/** Table: separators over gridlines, one hover and one selected state. */
export const table = {
  th: 'h-9 border-b border-(--mx-line) bg-(--mx-sunken) px-3 text-left align-middle font-normal whitespace-nowrap',
  td: 'border-b border-(--mx-line) px-3 align-top',
  row: 'group/row bg-(--mx-surface) transition-colors duration-100 hover:bg-[color-mix(in_srgb,var(--mx-surface),var(--mx-text)_3%)]',
  rowSelected: 'bg-[color-mix(in_srgb,var(--mx-surface),var(--mx-accent)_7%)] hover:bg-[color-mix(in_srgb,var(--mx-surface),var(--mx-accent)_9%)]',
  /** Divider after the sticky identity column, so it reads as a frozen pane. */
  frozen: 'border-r border-(--mx-line-strong)',
} as const
