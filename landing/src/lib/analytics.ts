import type { PostHog } from 'posthog-js';

/**
 * Marketing-site analytics. Mirrors frontend/src/lib/analytics.ts (same project, same
 * masking) and adds the two things the landing site exists to measure:
 *
 *  - which AI assistant sent the visitor (ChatGPT, Perplexity, Claude, Gemini, Copilot),
 *    kept as the `ai_referrer` super property so every later event carries it;
 *  - the human funnel: sections read, CTAs pressed, connectors searched, demo requested.
 *
 * AI *crawlers* never run this script; they are counted server-side in
 * functions/_middleware.ts.
 */
const KEY = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';
const enabled = !!KEY && (import.meta.env.PROD || import.meta.env.PUBLIC_POSTHOG_DEV === 'true');

const AI_SOURCES: [RegExp, string][] = [
  [/chatgpt\.com|chat\.openai\.com|openai/i, 'chatgpt'],
  [/perplexity/i, 'perplexity'],
  [/claude\.ai|anthropic/i, 'claude'],
  [/gemini\.google|bard\.google/i, 'gemini'],
  [/copilot\.microsoft|bing\.com\/chat/i, 'copilot'],
  [/you\.com|phind\.com|kagi\.com/i, 'other_ai'],
];

/** Classifies where an AI-assistant visitor came from, by referrer or utm_source. */
export function classifyAiReferrer(referrer: string, utmSource: string | null): string | null {
  for (const candidate of [utmSource ?? '', referrer]) {
    for (const [re, name] of AI_SOURCES) if (candidate && re.test(candidate)) return name;
  }
  return null;
}

export type LandingEvent =
  | ['cta_clicked', { location: string; label: string; href: string }]
  | ['page_section_viewed', { section: string }]
  | ['brain_question_answered', { company: string }]
  | ['matrix_lens_changed', { lens: string }]
  | ['board_block_inserted', { block: string }]
  | ['board_published', { words: number }]
  | ['integration_filtered', { category: string; query_length: number }]
  | ['integration_requested', { name: string }]
  | ['demo_form_started', Record<string, never>]
  | ['demo_form_submitted', { firm_type: string; aum_band: string; team_size: string }]
  | ['ai_referral_landing', { ai_referrer: string; path: string }];

let ph: PostHog | null = null;
const queue: [string, Record<string, unknown>][] = [];

export function track<E extends LandingEvent>(name: E[0], props: E[1]): void {
  if (!enabled) return;
  if (ph) ph.capture(name, props);
  else queue.push([name, props]);
}

/** Loads posthog-js only when a key is configured, after the page is idle. */
export async function initAnalytics(): Promise<void> {
  if (!enabled || ph) return;
  const { default: posthog } = await import('posthog-js');
  posthog.init(KEY!, {
    api_host: HOST,
    ui_host: 'https://us.posthog.com',
    defaults: '2025-11-30',
    person_profiles: 'identified_only',
    capture_exceptions: true,
    session_recording: { maskAllInputs: true },
  });

  const params = new URLSearchParams(location.search);
  const ai = classifyAiReferrer(document.referrer, params.get('utm_source'));
  if (ai) {
    posthog.register({ ai_referrer: ai });
    posthog.capture('ai_referral_landing', { ai_referrer: ai, path: location.pathname });
  }
  posthog.register({ site: 'landing' });
  ph = posthog;
  for (const [n, p] of queue.splice(0)) posthog.capture(n, p);
}

/** Wires the declarative hooks: data-track-cta on links, data-section on sections. */
export function wireDom(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-track-cta]');
    if (!el) return;
    track('cta_clicked', {
      location: el.dataset.trackCta || 'unknown',
      label: (el.textContent || '').trim().slice(0, 60),
      href: el.getAttribute('href') || '',
    });
  });

  const seen = new Set<string>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const name = (entry.target as HTMLElement).dataset.section;
        if (!entry.isIntersecting || !name || seen.has(name)) continue;
        seen.add(name);
        track('page_section_viewed', { section: name });
      }
    },
    { threshold: 0.4 },
  );
  document.querySelectorAll('[data-section]').forEach((el) => io.observe(el));
}
