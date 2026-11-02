import type { APIRoute, GetStaticPaths } from 'astro';
import { allPages, type MdPage } from '../lib/markdown';

/** /<page>.md: the markdown mirror of each page, for agents and LLM crawlers. */
export const getStaticPaths: GetStaticPaths = () =>
  allPages().map((page) => ({
    params: { slug: page.path === '/' ? 'index' : page.path.slice(1) },
    props: { page },
  }));

export const GET: APIRoute = ({ props }) => {
  const { page } = props as { page: MdPage };
  return new Response(`${page.body}\n`, { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
};
