/**
 * Portfolio Charts Component
 * 
 * Displays portfolio returns chart and daily returns heatmap.
 * Features:
 * - Period selector (day/week/month)
 * - Responsive grid layout
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui-v2/Card';
import { SectionHeader } from '../ui-v2/SectionHeader';
import { SegmentedControl } from '../ui-v2/SegmentedControl';
import { WeeklyReturnsChart } from '../charts/WeeklyReturnsChart';
import { DailyReturnsCalendar } from '../charts/DailyReturnsCalendar';

interface PortfolioChartsProps {
  portfolioReturns: Array<{ week: string; return: number; cumulativeReturn: number }>;
  recommendations: any[];
  loading?: boolean;
  onPeriodChange?: (period: 'day' | 'week' | 'month') => void;
  currentPeriod?: 'day' | 'week' | 'month';
}

export function PortfolioCharts({
  portfolioReturns,
  recommendations,
  loading = false,
  onPeriodChange,
  currentPeriod = 'day',
}: PortfolioChartsProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>(currentPeriod);

  const handlePeriodChange = (newPeriod: 'day' | 'week' | 'month') => {
    setPeriod(newPeriod);
    onPeriodChange?.(newPeriod);
  };

  return (
    <div className="mb-6">
      <SectionHeader
        title="Portfolio Performance"
        description="Track your returns and daily performance"
        actions={
          <SegmentedControl
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            value={period}
            onChange={handlePeriodChange}
            size="sm"
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Portfolio Returns Chart */}
        <Card variant="elevated" padding="lg">
          <CardHeader>
            <CardTitle size="md">Returns</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <WeeklyReturnsChart
                data={portfolioReturns}
                height={250}
              />
            )}
          </CardContent>
        </Card>

        {/* Daily Returns Heatmap */}
        <Card variant="elevated" padding="lg">
          <CardHeader>
            <CardTitle size="md">Daily Returns</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <DailyReturnsCalendar
                recommendations={recommendations}
                height={250}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

