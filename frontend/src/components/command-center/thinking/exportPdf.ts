/**
 * Exports the open note as a PDF through the browser's own print-to-PDF.
 *
 * The page cannot simply be printed in place: it lives inside fixed-height scrolling
 * panels, which would clip the PDF to one screen. So the rendered page is cloned into a
 * top-level container that is the only thing printed (see thinking.css, @media print).
 * Cloning the live DOM keeps the charts exactly as drawn -- Nivo renders SVG, which
 * prints as crisp vectors -- with no PDF library and no server round trip.
 */
export interface PdfMeta {
  ticker: string
  company: string | null
  title: string
}

const ROOT_ID = 'tb-print'

function clean(clone: HTMLElement) {
  // Editor chrome and controls have no place on paper.
  clone.querySelectorAll('.tb-no-print, button, details, [data-drag-handle]').forEach((n) => n.remove())
  clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'))
  // Sticky/scrolling wrappers would clip or float on paper.
  clone.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto').forEach((n) => {
    n.style.overflow = 'visible'
    n.style.maxHeight = 'none'
  })
}

function header(meta: PdfMeta): HTMLElement {
  const el = document.createElement('header')
  el.className = 'tb-print-header'
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const left = document.createElement('span')
  left.textContent = [meta.ticker, meta.company].filter(Boolean).join(' · ')
  const right = document.createElement('span')
  right.textContent = `AlphaBoard research note · ${date}`
  el.append(left, right)
  return el
}

export function exportNoteAsPdf(sheet: HTMLElement, meta: PdfMeta) {
  document.getElementById(ROOT_ID)?.remove()

  const root = document.createElement('div')
  root.id = ROOT_ID
  const clone = sheet.cloneNode(true) as HTMLElement
  clean(clone)
  root.append(header(meta), clone)
  document.body.appendChild(root)

  // The browser names the PDF after the document title.
  const previousTitle = document.title
  document.title = `${meta.ticker.replace(/\.(NS|BO)$/, '')} - ${meta.title}`.replace(/[\\/:*?"<>|]+/g, ' ')

  const cleanup = () => {
    root.remove()
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  // Let the clone lay out (fonts are already loaded) before the print snapshot is taken.
  requestAnimationFrame(() => window.print())
}
