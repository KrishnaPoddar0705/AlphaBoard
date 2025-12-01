#!/bin/bash

# Test Yahoo Finance API for BSE.NS
TICKER="BSE.NS"

# Calculate dates - 2 years back
END_DATE=$(date +%s)
START_DATE=$(date -v-2y +%s 2>/dev/null || date -d "2 years ago" +%s)

echo "Testing Yahoo Finance for $TICKER"
echo "Start: $(date -r $START_DATE '+%Y-%m-%d')"
echo "End: $(date -r $END_DATE '+%Y-%m-%d')"
echo ""

URL="https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?period1=${START_DATE}&period2=${END_DATE}&interval=1d"

echo "URL: $URL"
echo ""
echo "Fetching data..."
echo ""

curl -s "$URL" | jq '{
  ticker: .chart.result[0].meta.symbol,
  dataPoints: (.chart.result[0].timestamp | length),
  firstDate: (.chart.result[0].timestamp[0] | todate),
  lastDate: (.chart.result[0].timestamp[-1] | todate),
  error: .chart.error
}'
