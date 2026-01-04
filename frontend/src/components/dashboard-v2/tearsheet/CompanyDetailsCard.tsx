/**
 * CompanyDetailsCard Component
 * 
 * Displays company details: CEO, Industry, Sector, IPO date, Employees.
 */

// import React from 'react';
import { PaperCard } from '../paper/PaperCard';
import { StatList } from '../paper/StatList';
import { StatRow } from '../paper/StatRow';

interface CompanyDetails {
  ceo?: string;
  industry?: string;
  sector?: string;
  ipoDate?: string;
  employees?: number;
}

interface CompanyDetailsCardProps {
  details: CompanyDetails;
  className?: string;
}

export function CompanyDetailsCard({
  details,
  className = '',
}: CompanyDetailsCardProps) {
  return (
    <PaperCard padding="md" className={className}>
      <h3 className="text-base font-bold text-[var(--paper-ink)] mb-4">
        Company Details
      </h3>
      <StatList>
        {details.ceo && (
          <StatRow label="CEO" value={details.ceo} />
        )}
        {details.industry && (
          <StatRow label="Industry" value={details.industry} />
        )}
        {details.sector && (
          <StatRow label="Sector" value={details.sector} />
        )}
        {details.ipoDate && (
          <StatRow
            label="Went public"
            value={new Date(details.ipoDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
        )}
        {details.employees !== undefined && (
          <StatRow
            label="Full time employees"
            value={details.employees.toLocaleString()}
            showDivider={false}
          />
        )}
      </StatList>
    </PaperCard>
  );
}

