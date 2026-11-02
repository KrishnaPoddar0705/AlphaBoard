// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { SITE_URL } from './site.config.mjs';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap({ filter: (page) => !/\/(404|privacy|terms)$/.test(page) })],
});
