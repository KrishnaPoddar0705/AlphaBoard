/**
 * Cloudflare Pages middleware: the agent-facing half of the site's analytics.
 *
 * 1. AI crawler and agent visits never run JavaScript, so PostHog's browser SDK never
 *    sees them. Here every request whose user-agent matches a known AI or search bot
 *    is sent to PostHog as `ai_crawler_visit`, after the response, via waitUntil, so it
 *    adds no latency.
 * 2. Agents that ask for markdown (`Accept: text/markdown`) get the page's markdown
 *    mirror (`/<path>.md`, generated at build time) in place of HTML.
 *
 * Env (Pages project settings): POSTHOG_KEY, optional POSTHOG_HOST.
 */

interface Env {
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}
interface Ctx {
  request: Request;
  env: Env;
  next: (input?: Request | string) => Promise<Response>;
  waitUntil: (p: Promise<unknown>) => void;
}

type BotKind = 'ai_training' | 'ai_search' | 'ai_assistant' | 'search' | 'other_bot';
const BOTS: [RegExp, string, BotKind][] = [
  [/GPTBot/i, 'GPTBot', 'ai_training'],
  [/OAI-SearchBot/i, 'OAI-SearchBot', 'ai_search'],
  [/ChatGPT-User/i, 'ChatGPT-User', 'ai_assistant'],
  [/ClaudeBot/i, 'ClaudeBot', 'ai_training'],
  [/Claude-SearchBot/i, 'Claude-SearchBot', 'ai_search'],
  [/Claude-User/i, 'Claude-User', 'ai_assistant'],
  [/anthropic-ai/i, 'anthropic-ai', 'ai_training'],
  [/PerplexityBot/i, 'PerplexityBot', 'ai_search'],
  [/Perplexity-User/i, 'Perplexity-User', 'ai_assistant'],
  [/Google-CloudVertexBot|Google-Extended/i, 'Google-Extended', 'ai_training'],
  [/Gemini/i, 'Gemini', 'ai_assistant'],
  [/Applebot-Extended/i, 'Applebot-Extended', 'ai_training'],
  [/meta-externalagent|meta-externalfetcher/i, 'Meta', 'ai_training'],
  [/Amazonbot/i, 'Amazonbot', 'ai_training'],
  [/Bytespider/i, 'Bytespider', 'ai_training'],
  [/CCBot/i, 'CCBot', 'ai_training'],
  [/cohere-ai|cohere-training/i, 'Cohere', 'ai_training'],
  [/MistralAI-User/i, 'MistralAI-User', 'ai_assistant'],
  [/DuckAssistBot/i, 'DuckAssistBot', 'ai_assistant'],
  [/YouBot/i, 'YouBot', 'ai_search'],
  [/Diffbot/i, 'Diffbot', 'other_bot'],
  [/Googlebot/i, 'Googlebot', 'search'],
  [/bingbot/i, 'Bingbot', 'search'],
  [/Applebot/i, 'Applebot', 'search'],
  [/DuckDuckBot/i, 'DuckDuckBot', 'search'],
  [/YandexBot/i, 'YandexBot', 'search'],
];

export function classifyBot(ua: string): { bot: string; kind: BotKind } | null {
  for (const [re, bot, kind] of BOTS) if (re.test(ua)) return { bot, kind };
  return null;
}

function wantsMarkdown(req: Request, path: string): boolean {
  if (req.method !== 'GET' || /\.[a-z0-9]+$/i.test(path) || path.startsWith('/api/')) return false;
  const accept = req.headers.get('accept') || '';
  return /text\/markdown/i.test(accept) && !/text\/html/i.test(accept.split(',')[0] || '');
}

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';

  let response: Response;
  let servedMarkdown = false;
  if (wantsMarkdown(request, path)) {
    const md = await env.ASSETS.fetch(new URL(path === '/' ? '/index.md' : `${path}.md`, url).toString());
    if (md.ok) {
      servedMarkdown = true;
      response = new Response(md.body, {
        headers: { 'content-type': 'text/markdown; charset=utf-8', vary: 'accept', 'x-robots-tag': 'noindex' },
      });
    } else {
      response = await ctx.next();
    }
  } else {
    response = await ctx.next();
  }

  const ua = request.headers.get('user-agent') || '';
  const hit = classifyBot(ua);
  if (hit && env.POSTHOG_KEY) {
    const cf = (request as Request & { cf?: Record<string, unknown> }).cf || {};
    const host = env.POSTHOG_HOST || 'https://us.i.posthog.com';
    ctx.waitUntil(
      fetch(`${host}/capture/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: env.POSTHOG_KEY,
          event: 'ai_crawler_visit',
          distinct_id: `bot:${hit.bot}`,
          properties: {
            bot: hit.bot,
            bot_kind: hit.kind,
            path,
            status: response.status,
            served_markdown: servedMarkdown,
            country: cf.country ?? null,
            asn_org: cf.asOrganization ?? null,
            cf_ray: request.headers.get('cf-ray'),
            user_agent: ua.slice(0, 300),
            site: 'landing',
            $process_person_profile: false,
          },
        }),
      }).catch(() => undefined),
    );
  }
  return response;
};
