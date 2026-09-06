import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { prepareThesis, remarkHardBreaks } from '@/lib/markdown/thesis'

interface ThesisMarkdownProps {
  content: string | null | undefined
  className?: string
}

/**
 * Renders an investment thesis.
 *
 * Deliberately sets no colours. The seven places a thesis is displayed run on
 * four different palettes -- Tailwind greys, `var(--text-primary)`,
 * `var(--paper-ink)` and the literal paper token `#1C1B17` -- so this inherits
 * from whatever wraps it and borders itself with `currentColor` at low alpha.
 *
 * The caller must not wrap this in a <p>: markdown emits block elements, and
 * the browser reparents a <table> or <ul> found inside a paragraph, which both
 * scrambles the layout and trips React's validateDOMNesting warning.
 */
/**
 * react-markdown hands every custom component an mdast `node` prop. Spreading
 * that straight onto a DOM element renders node="[object Object]" into the
 * markup and trips a React unknown-prop warning, so it is dropped here.
 */
function clean<T extends object>(props: T & { node?: unknown }): T {
  const rest = { ...props }
  delete (rest as { node?: unknown }).node
  return rest as T
}

export default function ThesisMarkdown({ content, className = '' }: ThesisMarkdownProps) {
  const source = prepareThesis(content)
  if (!source.trim()) return null

  return (
    <div className={`thesis-markdown leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkHardBreaks]}
        components={{
          h1: (props) => <h1 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...clean(props)} />,
          h2: (props) => <h2 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...clean(props)} />,
          h3: (props) => <h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...clean(props)} />,
          h4: (props) => <h4 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...clean(props)} />,

          p: (props) => <p className="mb-3 last:mb-0" {...clean(props)} />,
          ul: (props) => <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0" {...clean(props)} />,
          ol: (props) => <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0" {...clean(props)} />,
          li: (props) => <li {...clean(props)} />,

          // Wide tables scroll inside their own container rather than widening
          // the page -- the mobile-first rule.
          table: (props) => (
            <div className="my-3 max-w-full overflow-x-auto">
              <table className="w-full border-collapse border border-current/20 text-left" {...clean(props)} />
            </div>
          ),
          thead: (props) => <thead className="bg-current/5" {...clean(props)} />,
          tr: (props) => <tr className="border-b border-current/20 last:border-b-0" {...clean(props)} />,
          th: (props) => (
            <th className="border-r border-current/20 px-3 py-2 font-semibold last:border-r-0" {...clean(props)} />
          ),
          td: (props) => (
            <td className="border-r border-current/20 px-3 py-2 align-top last:border-r-0" {...clean(props)} />
          ),

          code: (props) => <code className="rounded bg-current/10 px-1 py-0.5 text-[0.9em]" {...clean(props)} />,
          pre: (props) => (
            <pre className="mb-3 overflow-x-auto rounded bg-current/5 p-3 text-[0.9em] last:mb-0" {...clean(props)} />
          ),
          blockquote: (props) => (
            <blockquote className="my-3 border-l-2 border-current/30 pl-3 opacity-90" {...clean(props)} />
          ),
          hr: (props) => <hr className="my-4 border-current/20" {...clean(props)} />,
          strong: (props) => <strong className="font-semibold" {...clean(props)} />,
          em: (props) => <em className="italic" {...clean(props)} />,
          a: (props) => (
            <a
              {...clean(props)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
            />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
