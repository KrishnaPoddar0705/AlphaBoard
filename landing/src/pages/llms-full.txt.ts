import type { APIRoute } from 'astro';
import { allPages } from '../lib/markdown';
import { SITE_URL } from '../lib/site';

/** Every page's content in one file, for LLMs that read a site in a single request. */
export const GET: APIRoute = () => {
  const body = allPages()
    .map((p) => `<!-- ${new URL(p.path, SITE_URL)} -->\n\n${p.body}`)
    .join('\n\n---\n\n');
  return new Response(`${body}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
