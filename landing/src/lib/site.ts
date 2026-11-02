import { SITE_URL } from '../../site.config.mjs';

export { SITE_URL };
export const APP_URL = import.meta.env.PUBLIC_APP_URL ?? 'https://alphaboard.theunicornlabs.com/';
export const SITE_NAME = 'AlphaBoard';
export const TAGLINE = 'Institutional memory for Indian investment firms';
export const DEFAULT_DESCRIPTION =
  'AlphaBoard is institutional memory for Indian investment firms. The Matrix puts every event across every analyst and company on one timeline, the Thinking Board turns data and notes into a published log entry, and Institutional Memory lets you ask across every report your firm holds.';

export const NAV = [
  { href: '/product/matrix', label: 'Matrix' },
  { href: '/#thinking-board', label: 'Thinking Board' },
  { href: '/product/company-brain', label: 'Institutional Memory' },
  { href: '/solutions', label: 'Solutions' },
  { href: '/security', label: 'Security' },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/product/matrix', label: 'Matrix' },
      { href: '/#thinking-board', label: 'Thinking Board' },
      { href: '/product/company-brain', label: 'Institutional Memory' },
      { href: '/integrations', label: 'Connectors' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { href: '/solutions/pms', label: 'PMS' },
      { href: '/solutions/aif', label: 'AIF' },
      { href: '/solutions/family-offices', label: 'Family offices' },
      { href: '/solutions/venture-capital', label: 'Venture capital' },
      { href: '/india', label: 'Built for Indian markets' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/security', label: 'Security' },
      { href: '/for-agents', label: 'For AI agents' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
  {
    title: 'Talk to us',
    links: [
      { href: '/demo', label: 'Book a demo' },
      { href: APP_URL, label: 'Sign in' },
      { href: '/llms.txt', label: 'llms.txt' },
    ],
  },
] as const;
