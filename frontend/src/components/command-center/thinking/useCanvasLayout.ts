import { useEffect, useState, type RefObject } from 'react'

/**
 * Where connector cards go, by the canvas's OWN width rather than the window's: the app
 * sidebar and the note tree both eat into it, so a 1440px window can leave a narrow canvas.
 *
 *  - 'single': the page as the main panel, cards in one column on its right
 *  - 'stack':  no gutter -- cards sit inline above the page (tablet, phone)
 *  - 'double': cards in both gutters. No longer chosen: the desk reads as document-left,
 *    data-right at every width. Kept in the type for cards saved with side 'left'.
 *
 * The page shrinks (to MIN_PAGE_WIDTH) before the card column is given up. Requiring the
 * full PAGE_WIDTH dropped to 'stack' as soon as the note tree opened, which put the cards
 * in a strip above the document.
 */
export type CanvasLayout = 'double' | 'single' | 'stack'

export const PAGE_WIDTH = 760
export const CARD_WIDTH = 340
const GAP = 40
const MIN_PAGE_WIDTH = 520

export function useCanvasLayout(ref: RefObject<HTMLElement | null>): CanvasLayout {
  const [layout, setLayout] = useState<CanvasLayout>('stack')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (w: number) => {
      setLayout(w >= MIN_PAGE_WIDTH + CARD_WIDTH + GAP + 48 ? 'single' : 'stack')
    }
    measure(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return layout
}
