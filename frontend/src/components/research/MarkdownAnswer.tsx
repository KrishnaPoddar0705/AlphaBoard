import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownAnswerProps {
  content: string;
  citations?: Array<{
    excerpt: string;
    page?: number;
    source?: string;
    report_id?: string;
    title?: string;
  }>;
  onCitationClick?: (reportId: string) => void;
}

export default function MarkdownAnswer({ 
  content, 
  citations = [],
  onCitationClick 
}: MarkdownAnswerProps) {
  // Clean content - remove any accidental JSON code blocks
  const cleanContent = (text: string): string => {
    // Remove JSON code blocks that might have been accidentally included
    let cleaned = text.replace(/```json\s*[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/```\s*\{[\s\S]*?\}\s*```/g, '');
    
    // Remove standalone JSON objects (basic pattern)
    cleaned = cleaned.replace(/^\s*\{[\s\S]*"answer"[\s\S]*\}\s*$/gm, '');
    
    return cleaned.trim();
  };

  // Process content to convert citation numbers [1], [2] into clickable superscripts
  const processCitations = (text: string): string => {
    // Replace [1], [2], [3] etc. with clickable citation links
    // Match standalone citation numbers that are not already part of markdown links
    return text.replace(/\[(\d+)\]/g, (match, num, offset, fullText) => {
      // Check if this is already part of a markdown link [text](url)
      const after = fullText.substring(offset + match.length);
      
      // If it's followed by ( it's already a markdown link, skip it
      if (after.trim().startsWith('(')) {
        return match;
      }
      
      const citationIndex = parseInt(num) - 1; // Convert to 0-based index
      if (citationIndex >= 0 && citationIndex < citations.length) {
        // Create a markdown link that will be rendered as a citation button
        // Use a special format that our link renderer will recognize
        return `[${num}](#citation-${num})`;
      }
      return match;
    });
  };

  const cleanedContent = cleanContent(content);
  const processedContent = processCitations(cleanedContent);

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-6 mb-4 pb-2 border-b border-[var(--border-color)]" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-5 mb-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mt-4 mb-2" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-semibold text-[var(--text-primary)] mt-3 mb-2" {...props} />
          ),

          // Paragraphs
          p: ({ node, ...props }) => (
            <p className="text-[var(--text-primary)] mb-4 leading-relaxed" {...props} />
          ),

          // Lists
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside mb-4 space-y-2 text-[var(--text-primary)] ml-4" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside mb-4 space-y-2 text-[var(--text-primary)] ml-4" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="mb-1" {...props} />
          ),

          // Tables
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-6">
              <table className="w-full border-collapse border border-[var(--border-color)] rounded-lg" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-[var(--bg-secondary)]" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="border-b border-[var(--border-color)] hover:bg-[var(--list-item-hover)] transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] last:border-r-0" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-4 py-3 text-[var(--text-primary)] border-r border-[var(--border-color)] last:border-r-0" {...props} />
          ),

          // Code blocks
          code: ({ node, inline, ...props }: any) => {
            if (inline) {
              return (
                <code className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-sm text-[var(--text-primary)] font-mono" {...props} />
              );
            }
            return (
              <code className="block p-4 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-primary)] font-mono overflow-x-auto mb-4" {...props} />
            );
          },
          pre: ({ node, ...props }) => (
            <pre className="mb-4" {...props} />
          ),

          // Links - Handle citation links and regular links
          a: ({ node, ...props }: any) => {
            const href = props.href;
            
            // Check if it's a citation link (format: #citation-1, #citation-2, etc.)
            const citationMatch = href?.match(/^#citation-(\d+)$/);
            
            if (citationMatch) {
              const citationNum = parseInt(citationMatch[1]);
              const citationIndex = citationNum - 1; // Convert to 0-based index
              
              if (citationIndex >= 0 && citationIndex < citations.length) {
                const citation = citations[citationIndex];
                
                return (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      // Scroll to citation section
                      const citationElement = document.getElementById(`citation-ref-${citationNum}`);
                      if (citationElement) {
                        citationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Highlight briefly
                        citationElement.classList.add('citation-highlight');
                        setTimeout(() => {
                          citationElement.classList.remove('citation-highlight');
                        }, 2000);
                      }
                      // Also navigate to report if available
                      if (citation.report_id && onCitationClick) {
                        onCitationClick(citation.report_id);
                      }
                    }}
                    className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-indigo-400 bg-indigo-500/20 hover:bg-indigo-500/30 rounded-full transition-all hover:scale-110 ml-1 align-super"
                    title={`Citation ${citationNum}: Page ${citation.page || 'N/A'}${citation.title ? ` - ${citation.title}` : ''}`}
                  >
                    {citationNum}
                  </button>
                );
              }
            }
            
            // Regular external links
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                {...props}
              />
            );
          },

          // Blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-[var(--text-secondary)] my-4" {...props} />
          ),

          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-[var(--border-color)]" {...props} />
          ),

          // Strong and emphasis
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-[var(--text-primary)]" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-[var(--text-primary)]" {...props} />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

