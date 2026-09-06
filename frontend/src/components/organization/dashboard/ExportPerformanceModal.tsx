import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getPrice, getStockSummary, getPriceForDate } from '../../../lib/api';
import { safeError, safeWarn } from '../../../lib/logger';
import { getUserFriendlyError } from '../../../lib/errorSanitizer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

/** Quote a CSV field only when it could otherwise break column alignment. */
function escapeCsvValue(value: string): string {
  const stringValue = String(value);
  if (/[,"\n()]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/** "Jan 14 2026" -- no comma, so it survives a CSV header unquoted. */
function formatDateForHeader(dateString: string): string {
  return new Date(dateString)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(',', '');
}

/**
 * Exports a performance CSV for a given set of analysts.
 *
 * `userIds` is what makes this reusable: the Admin Dashboard passes every member of
 * the organization, the Team Dashboard passes one team's roster, and neither needs
 * its own copy of the pricing and CSV logic.
 */
export default function ExportPerformanceModal({
  open,
  onOpenChange,
  userIds,
  filenamePrefix = 'performance_export',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIds: string[];
  filenamePrefix?: string;
}) {
  const [baseDate, setBaseDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const close = () => {
    onOpenChange(false);
    setBaseDate('');
  };

  const handleExport = async () => {
    if (!baseDate) {
      alert('Please select a base date');
      return;
    }
    if (userIds.length === 0) {
      alert('There are no analysts to export');
      return;
    }

    setIsExporting(true);
    try {
      const { data: recommendations, error: recsError } = await supabase
        .from('recommendations')
        .select('id, ticker, user_id, action, entry_price, entry_date, status, exit_price, exit_date')
        .in('user_id', userIds)
        .neq('status', 'WATCHLIST')
        .neq('action', 'WATCH')
        .order('entry_date', { ascending: false });

      if (recsError) {
        throw new Error('Failed to fetch recommendations: ' + getUserFriendlyError(recsError));
      }

      if (!recommendations || recommendations.length === 0) {
        alert('No recommendations found to export');
        setIsExporting(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const profilesMap = new Map<string, string>(
        profiles?.map((p: any) => [p.id, p.username || 'Unknown']) || []
      );

      // Two sources for the Team column, in priority order: the recommendation's own
      // tags, and -- only when it has none at all -- its author's current teams. That
      // mirrors the read-time fallback in get-visible-recommendations, so the CSV and
      // the dashboards never disagree about which desk an idea sits on.
      const { data: tagRows } = await supabase
        .from('recommendation_teams')
        .select('recommendation_id, teams(id, name)')
        .in('recommendation_id', recommendations.map((r: any) => r.id));

      const recTeamsMap = new Map<string, string[]>();
      tagRows?.forEach((row: any) => {
        const name = (row.teams as any)?.name;
        if (!name) return;
        if (!recTeamsMap.has(row.recommendation_id)) recTeamsMap.set(row.recommendation_id, []);
        recTeamsMap.get(row.recommendation_id)!.push(name);
      });

      const { data: teamMemberships } = await supabase
        .from('team_members')
        .select('user_id, team_id, teams(id, name)')
        .in('user_id', userIds);

      const userTeamsMap = new Map<string, string[]>();
      teamMemberships?.forEach((tm: any) => {
        const name = (tm.teams as any)?.name;
        if (!name) return;
        if (!userTeamsMap.has(tm.user_id)) userTeamsMap.set(tm.user_id, []);
        userTeamsMap.get(tm.user_id)!.push(name);
      });

      const exportData = await Promise.all(
        recommendations.map(async (rec: any) => {
          try {
            let companyName = rec.ticker;
            try {
              const summary = await getStockSummary(rec.ticker);
              companyName = summary?.companyName || rec.ticker;
            } catch {
              // Ticker is a fine fallback for a display column.
            }

            let currentPrice = 0;
            try {
              const priceData = await getPrice(rec.ticker);
              currentPrice = priceData.price || 0;
            } catch {
              // Keep 0.
            }

            // Price on the base date, falling back to entry price when the position
            // was already open on that date and no quote is available.
            let basePrice = 0;
            const baseDateObj = new Date(baseDate);
            baseDateObj.setHours(0, 0, 0, 0);
            const entryDate = new Date(rec.entry_date);
            entryDate.setHours(0, 0, 0, 0);
            try {
              const priceData = await getPriceForDate(rec.ticker, baseDate);
              if (priceData && priceData.found && priceData.close && priceData.close > 0) {
                basePrice = priceData.close;
              } else if (entryDate <= baseDateObj) {
                basePrice = rec.entry_price;
              }
            } catch (error) {
              safeWarn('Error fetching price for base date:', error);
              if (entryDate <= baseDateObj) basePrice = rec.entry_price;
            }

            const recommendedPrice = rec.entry_price;
            const percentageGainLoss =
              recommendedPrice > 0 && currentPrice > 0
                ? ((currentPrice - recommendedPrice) / recommendedPrice) * 100
                : 0;

            const teamNames = recTeamsMap.get(rec.id) ?? userTeamsMap.get(rec.user_id) ?? [];
            const isClosed = rec.status === 'CLOSED';

            return {
              companyName,
              basePrice: basePrice.toFixed(2),
              currentPrice: currentPrice.toFixed(2),
              recommendationAction: rec.action || 'BUY',
              recommendedPrice: recommendedPrice.toFixed(2),
              recommendedDate: new Date(rec.entry_date).toLocaleDateString('en-US'),
              percentageGainLoss: percentageGainLoss.toFixed(2),
              analyst: profilesMap.get(rec.user_id) || 'Unknown',
              team: teamNames.join(', ') || 'No Team',
              closed: isClosed ? 'Yes' : '',
              exitPrice: isClosed && rec.exit_price ? rec.exit_price.toFixed(2) : '',
              exitDate: isClosed && rec.exit_date ? new Date(rec.exit_date).toLocaleDateString('en-US') : '',
            };
          } catch (error) {
            safeError('Error processing recommendation:', error);
            return null;
          }
        })
      );

      const validData = exportData.filter((item) => item !== null) as NonNullable<typeof exportData[number]>[];

      const currentDate = new Date()
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        .replace(',', '');

      const headers = [
        'Company Name',
        `Price on ${formatDateForHeader(baseDate)}`,
        `Current Market Price (${currentDate})`,
        'Recommendation Action',
        'Recommended Price',
        'Recommended Date',
        'Percentage Gain/Loss',
        'Analyst',
        'Team',
        'Closed',
        'Exit Price',
        'Exit Date',
      ].map(escapeCsvValue);

      const csvRows = [
        headers.join(','),
        ...validData.map((row) =>
          [
            escapeCsvValue(row.companyName),
            row.basePrice,
            row.currentPrice,
            row.recommendationAction,
            row.recommendedPrice,
            escapeCsvValue(row.recommendedDate),
            row.percentageGainLoss,
            escapeCsvValue(row.analyst),
            escapeCsvValue(row.team),
            row.closed,
            row.exitPrice,
            escapeCsvValue(row.exitDate),
          ].join(',')
        ),
      ];

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filenamePrefix}_${baseDate}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      close();
      alert(`Successfully exported ${validData.length} recommendations`);
    } catch (error: any) {
      safeError('Error exporting performance:', error);
      alert('Failed to export performance: ' + getUserFriendlyError(error));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Performance</DialogTitle>
          <DialogDescription>
            Select a base date to calculate performance metrics. The export will include all
            recommendations with prices on the selected date and current prices.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Base Date for Price Calculation</Label>
            <Input
              type="date"
              value={baseDate}
              onChange={(e) => setBaseDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-[#6F6A60]">
              Select the date to use as the base price reference point
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={close} disabled={isExporting}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={!baseDate || isExporting}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400"
            >
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
