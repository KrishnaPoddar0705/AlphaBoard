/**
 * AboutPanel Component
 * 
 * Right column displaying company description and website link.
 */

// import React from 'react';
import { PaperCard } from '../paper/PaperCard';
import { ExternalLink } from 'lucide-react';

interface AboutPanelProps {
  companyName: string;
  website?: string;
  description?: string;
  className?: string;
}

export function AboutPanel({
  companyName,
  website,
  description,
  className = '',
}: AboutPanelProps) {
  return (
    <PaperCard padding="md" className={className}>
      <h2 className="text-base font-bold text-[var(--paper-ink)] mb-3">
        About {companyName}
      </h2>
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--paper-link)] hover:text-[var(--paper-link-hover)] underline inline-flex items-center gap-1 mb-3"
        >
          {website.replace(/^https?:\/\//, '')}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {description ? (
        <p className="text-sm text-[var(--paper-ink)] leading-relaxed">
          {description}
        </p>
      ) : (
        <p className="text-sm text-[var(--paper-muted)] italic">
          No description available
        </p>
      )}
    </PaperCard>
  );
}



