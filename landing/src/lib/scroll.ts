/**
 * Lenis smooth scroll, shared by every page. Same-page anchor links glide through Lenis
 * instead of jumping. The instance is exposed as window.alphaLenis (Lenis itself writes
 * its own metadata to window.lenis).
 */
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

declare global {
  interface Window { alphaLenis?: Lenis }
}

export function startScroll(): Lenis | undefined {
  if (window.alphaLenis) return window.alphaLenis;
  // Automated browsers (audits, crawlers' renderers) step through the page with
  // programmatic scrolls; inertia would only blur what they measure.
  if (navigator.webdriver) return undefined;
  const lenis = new Lenis({ duration: 1.15, smoothWheel: true, autoRaf: true });
  window.alphaLenis = lenis;

  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.querySelector<HTMLElement>(a.getAttribute('href')!);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -72 });
    history.replaceState(null, '', a.getAttribute('href'));
  });
  return lenis;
}
