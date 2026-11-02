import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

/** AI and search crawlers are welcome: being cited by assistants is part of the plan. */
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Amazonbot',
  'meta-externalagent', 'DuckAssistBot', 'MistralAI-User', 'cohere-ai',
];

export const GET: APIRoute = () => {
  const body = [
    ...AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /api/`),
    'User-agent: *\nAllow: /\nDisallow: /api/',
    `Sitemap: ${new URL('/sitemap-index.xml', SITE_URL)}`,
    `# Agents: ${new URL('/llms.txt', SITE_URL)}`,
  ].join('\n\n');
  return new Response(`${body}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
