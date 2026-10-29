import { useEffect, useState, type RefObject } from 'react'

/**
 * Where connector cards go, by the canvas's OWN width rather than the window's: the app
 * sidebar and the note tree both eat into it, so a 1440px window can leave a narrow canvas.
 *
 *  - 'double': cards float in both gutters beside the page (the full desk)
 *  - 'single': one gutter on the right
 *  - 'stack':  no gutters -- cards sit inline above the page (tablet, phone)
 */
export type CanvasLayout = 'double' | 'single' | 'stack'

export const PAGE_WIDTH = 760
export const CARD_WIDTH = 340
const GAP = 40

export function useCanvasLayout(ref: RefObject<HTMLElement | null>): CanvasLayout {
  const [layout, setLayout] = useState<CanvasLayout>('stack')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (w: number) => {
      if (w >= PAGE_WIDTH + 2 * (CARD_WIDTH + GAP) + 32) setLayout('double')
      else if (w >= PAGE_WIDTH + CARD_WIDTH + GAP + 48) setLayout('single')
      else setLayout('stack')
    }
    measure(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return layout
}
