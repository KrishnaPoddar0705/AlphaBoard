import { Navigate, useParams, useSearchParams } from 'react-router-dom';

/**
 * The library, report and chat pages were merged into /research. Old links
 * (/research/:id?page=&q=, /research/chat/:conversationId) land on the same thing there.
 */
export default function LegacyResearchRedirect({ kind }: { kind: 'report' | 'chat' }) {
  const { id, conversationId } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams();
  if (kind === 'report' && id) {
    next.set('doc', id);
    if (params.get('page')) next.set('page', params.get('page')!);
    if (params.get('q')) next.set('find', params.get('q')!);
  }
  if (kind === 'chat' && conversationId) next.set('chat', conversationId);
  const qs = next.toString();
  return <Navigate to={`/research${qs ? `?${qs}` : ''}`} replace />;
}
