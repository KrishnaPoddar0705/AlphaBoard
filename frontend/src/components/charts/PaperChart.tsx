/**
 * PaperChart Component
 * 
 * Wrapper that applies paper theme styling to charts.
 * Ensures charts blend with the warm paper background.
 */

import React from 'react';
import ChartRenderer from './ChartRenderer';

interface PaperChartProps {
  chartId: number;
  stockTicker: string;
  height?: number;
  technicalType?: 'line' | 'candlestick';
  externalData?: any[];
  customDateRange?: { start: string; end: string };
}

export function PaperChart({
  chartId,
  stockTicker,
  height = 400,
  technicalType = 'line',
  externalData,
  customDateRange,
}: PaperChartProps) {
  return (
    <>
      <style>{`
        .paper-chart-container {
          background: transparent !important;
        }
        .paper-chart-container .highcharts-container {
          background-color: transparent !important;
        }
        .paper-chart-container .highcharts-background {
          fill: transparent !important;
        }
        .paper-chart-container .highcharts-plot-background {
          fill: transparent !important;
        }
        .paper-chart-container .highcharts-grid-line {
          stroke: var(--paper-rule) !important;
          stroke-width: 1 !important;
        }
        .paper-chart-container .highcharts-axis-labels text {
          fill: var(--paper-muted) !important;
        }
        .paper-chart-container .highcharts-title text {
          fill: var(--paper-ink) !important;
        }
        .paper-chart-container .highcharts-series path {
          stroke: var(--paper-ink) !important;
        }
        .paper-chart-container .highcharts-area {
          fill: var(--paper-ink) !important;
          opacity: 0.1;
        }
        .paper-chart-container .highcharts-tooltip-box {
          fill: var(--paper-bg) !important;
          stroke: var(--paper-border) !important;
        }
        .paper-chart-container .highcharts-tooltip text {
          fill: var(--paper-ink) !important;
        }
        /* Override ChartRenderer's dark wrapper */
        .paper-chart-container > div {
          background: transparent !important;
          border: none !important;
        }
        .paper-chart-container > div > div {
          background: transparent !important;
        }
      `}</style>
      <div className="paper-chart-container">
        <ChartRenderer
          chartId={chartId}
          stockTicker={stockTicker}
          height={height}
          technicalType={technicalType}
          externalData={externalData}
          customDateRange={customDateRange}
        />
      </div>
    </>
  );
}

