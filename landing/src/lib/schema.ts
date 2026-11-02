import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from './site';

type Json = Record<string, unknown>;
const abs = (path: string) => new URL(path, SITE_URL).toString();

export const organization = (): Json => ({
  '@type': 'Organization',
  '@id': abs('/#org'),
  name: SITE_NAME,
  url: SITE_URL,
  logo: abs('/favicon.svg'),
  description: DEFAULT_DESCRIPTION,
  areaServed: { '@type': 'Country', name: 'India' },
  knowsAbout: [
    'Equity research management', 'Portfolio management services (PMS)',
    'Alternative investment funds (AIF)', 'Analyst performance measurement',
    'Investment research audit trail', 'Family office investing',
  ],
});

export const website = (): Json => ({
  '@type': 'WebSite',
  '@id': abs('/#website'),
  url: SITE_URL,
  name: SITE_NAME,
  inLanguage: 'en-IN',
  publisher: { '@id': abs('/#org') },
});

export const softwareApplication = (): Json => ({
  '@type': 'SoftwareApplication',
  '@id': abs('/#app'),
  name: SITE_NAME,
  applicationCategory: 'FinanceApplication',
  applicationSubCategory: 'Investment research management',
  operatingSystem: 'Web',
  description: DEFAULT_DESCRIPTION,
  audience: {
    '@type': 'BusinessAudience',
    audienceType: 'Equity analysts, portfolio managers and fund managers at PMS, AIF, family office and venture capital firms',
  },
  featureList: [
    'One research record per company: filings, broker reports, concall and meeting notes, internal comments',
    'Matrix: every event across every analyst and company on one timeline',
    'Institutional Memory: ask across uploaded filings, broker reports and internal notes, with numbered sources',
    'Thinking Board: pull concalls, results and statements into a note, then publish it to the log',
    'Command Center: every analyst’s research activity for PMs and fund managers',
    'PM review queue and coverage gap alerts',
    'WhatsApp assistant for prices, alerts and recommendations',
  ],
  offers: { '@type': 'Offer', availability: 'https://schema.org/PreOrder', url: abs('/demo') },
  publisher: { '@id': abs('/#org') },
});

export const faqPage = (items: { q: string; a: string }[]): Json => ({
  '@type': 'FAQPage',
  mainEntity: items.map((i) => ({
    '@type': 'Question',
    name: i.q,
    acceptedAnswer: { '@type': 'Answer', text: i.a },
  })),
});

export const breadcrumbs = (trail: { name: string; path: string }[]): Json => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((t, i) => ({
    '@type': 'ListItem', position: i + 1, name: t.name, item: abs(t.path),
  })),
});

export const graph = (...nodes: Json[]) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
