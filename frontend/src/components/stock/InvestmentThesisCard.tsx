/**
 * InvestmentThesisCard Component
 * 
 * AI-Assisted Investment Thesis card with collapsible sections,
 * regenerate functionality, and export options (PDF/Notion).
 */

import { useState } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle, 
  Rocket, 
  Star,
  RefreshCw,
  Download,
  FileText,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Accordion, AccordionItem } from '../ui/Accordion';
import { Skeleton } from '../ui/Skeleton';
import { useThesis } from '../../hooks/useThesis';
import { useExport } from '../../hooks/useExport';
// import type { Thesis } from '../../types/thesis'; // Unused but kept for reference

interface InvestmentThesisCardProps {
  ticker: string;
  analystNotes?: string;
}

export function InvestmentThesisCard({ ticker, analystNotes }: InvestmentThesisCardProps) {
  const { thesis, isLoading, error, regenerate } = useThesis(ticker, analystNotes);
  const { isExporting, exportError, exportToPDF, exportToNotion } = useExport();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleRegenerate = async () => {
    await regenerate();
  };

  const handlePDFExport = async () => {
    if (!thesis) return;
    try {
      await exportToPDF(thesis);
      setShowExportMenu(false);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  const handleNotionExport = async () => {
    if (!thesis) return;
    try {
      await exportToNotion(thesis, `Investment Thesis: ${ticker}`);
      setShowExportMenu(false);
    } catch (err) {
      console.error('Notion export failed:', err);
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'buy':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'sell':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'hold':
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  if (isLoading && !thesis) {
    return <ThesisSkeleton />;
  }

  if (error && !thesis) {
    return (
      <Card variant="glass">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <p className="text-[var(--text-primary)] mb-2">Unable to generate thesis</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
          <button
            onClick={handleRegenerate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!thesis) {
    return null;
  }

  return (
    <Card variant="glass" className="relative overflow-hidden">
      {/* Header */}
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle size="lg">AI-Assisted Investment Thesis</CardTitle>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Generated {new Date(thesis.generated_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Regenerate Button */}
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Regenerate</span>
                </>
              )}
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--list-item-hover)] text-[var(--text-primary)] rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-xl z-20 overflow-hidden">
                    <button
                      onClick={handlePDFExport}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--list-item-hover)] transition-colors flex items-center gap-3 text-[var(--text-primary)] disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>Export to PDF</span>
                    </button>
                    <button
                      onClick={handleNotionExport}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--list-item-hover)] transition-colors flex items-center gap-3 text-[var(--text-primary)] disabled:opacity-50 border-t border-[var(--border-color)]"
                    >
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Export to Notion</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rating Badge */}
        <div className="mt-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getRatingColor(thesis.rating)}`}>
            <Star className="w-4 h-4" />
            <span className="text-sm font-semibold">{thesis.rating}</span>
          </div>
          {thesis.ratingJustification && (
            <p className="text-xs text-[var(--text-secondary)] mt-2 ml-1">{thesis.ratingJustification}</p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary */}
        {thesis.summary && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Summary</h4>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">{thesis.summary}</p>
          </div>
        )}

        {/* Accordion Sections */}
        <Accordion>
          <AccordionItem
            title="Bull Case"
            icon={<TrendingUp className="w-4 h-4" />}
            defaultOpen={true}
          >
            <p className="text-[var(--text-primary)]">{thesis.bullCase}</p>
          </AccordionItem>

          <AccordionItem
            title="Bear Case"
            icon={<TrendingDown className="w-4 h-4" />}
          >
            <p className="text-[var(--text-primary)]">{thesis.bearCase}</p>
          </AccordionItem>

          <AccordionItem
            title="Base Case"
            icon={<Target className="w-4 h-4" />}
          >
            <p className="text-[var(--text-primary)]">{thesis.baseCase}</p>
          </AccordionItem>

          <AccordionItem
            title="Key Risks"
            icon={<AlertTriangle className="w-4 h-4" />}
          >
            <ul className="space-y-2">
              {thesis.risks.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-rose-400 mt-1">•</span>
                  <span className="text-[var(--text-primary)]">{risk}</span>
                </li>
              ))}
            </ul>
          </AccordionItem>

          <AccordionItem
            title="Key Catalysts"
            icon={<Rocket className="w-4 h-4" />}
          >
            <ul className="space-y-2">
              {thesis.catalysts.map((catalyst, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span className="text-[var(--text-primary)]">{catalyst}</span>
                </li>
              ))}
            </ul>
          </AccordionItem>
        </Accordion>

        {/* Export Error */}
        {exportError && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <p className="text-xs text-rose-400">{exportError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loading Skeleton for Thesis Card
 */
function ThesisSkeleton() {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="space-y-2">
              <Skeleton width={200} height={20} />
              <Skeleton width={120} height={12} />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton width={100} height={36} />
            <Skeleton width={80} height={36} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton width={80} height={16} />
            <Skeleton height={60} />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton width={120} height={16} />
              <Skeleton height={40} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default InvestmentThesisCard;

