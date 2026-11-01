import { useEffect, useRef, useState } from 'react';
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';

interface PdfPageProps {
  doc: PDFDocumentProxy;
  number: number;
  scale: number;
  /** Width / height of the first page, so pages not yet drawn keep their place. */
  aspect: number;
  width: number;
  /** Words to highlight on the page, lower-case. */
  terms: string[];
}

/** One page, drawn only when it comes near the screen: a canvas, with selectable text over it. */
export default function PdfPage({ doc, number, scale, aspect, width, terms }: PdfPageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let task: RenderTask | null = null;
    let textLayer: TextLayer | null = null;
    let cancelled = false;

    (async () => {
      const page = await doc.getPage(number);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      setSize({ w: viewport.width, h: viewport.height });

      const canvas = canvasRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      task = page.render({
        canvasContext: canvas.getContext('2d')!,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      await task.promise.catch(() => undefined);
      if (cancelled) return;

      const textDiv = textRef.current!;
      textDiv.replaceChildren();
      textDiv.style.setProperty('--scale-factor', String(scale));
      textLayer = new TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport });
      await textLayer.render().catch(() => undefined);
      if (cancelled || terms.length === 0) return;
      for (const span of textDiv.querySelectorAll('span')) {
        const t = span.textContent?.toLowerCase() ?? '';
        if (terms.some((w) => t.includes(w))) span.classList.add('ab-pdf-hit');
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
      textLayer?.cancel();
    };
  }, [near, doc, number, scale, terms]);

  const w = size?.w ?? width;
  const h = size?.h ?? width / aspect;

  return (
    <div
      ref={ref}
      data-page={number}
      className="relative mx-auto overflow-hidden rounded-md border border-[#D7D0C2] bg-white"
      style={{ width: w, height: h }}
      aria-label={`Page ${number}`}
    >
      <canvas ref={canvasRef} className="block" style={{ width: w, height: h }} />
      <div ref={textRef} className="ab-pdf-text" />
    </div>
  );
}
