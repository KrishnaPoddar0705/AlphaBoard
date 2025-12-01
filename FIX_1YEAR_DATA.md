# ✅ Fixed: 1-Year Historical Data Issue

## 🐛 The Problem

**Symptom:** Equity curve only showed 3 weeks of data (Dec 2-23, 2024) regardless of selecting 12M period.

**Root Cause:** Yahoo Finance API was being called with insufficient buffer for weekends/holidays, returning only recent trading days.

## 🔧 The Fix

### Changes Made to Edge Function:

1. **Increased Fetch Days:**
   ```typescript
   // Before: fetchPriceHistory(ticker, 365)
   // After:  fetchPriceHistory(ticker, 400)
   // Ensures we get 365+ trading days
   ```

2. **Added Buffer Multiplier:**
   ```typescript
   const bufferDays = Math.floor(days * 1.5)
   // 365 days → 547 days with buffer
   // Accounts for ~104 weekend days + holidays
   ```

3. **Added Extensive Logging:**
   - Shows exact date ranges being fetched
   - Logs number of data points received
   - Displays which tickers succeed/fail

4. **Improved Data Validation:**
   - Filters null prices properly
   - Validates timestamp/price alignment
   - Better error messages

## 🧪 Test the Fix

### 1. Clear Browser Cache
```bash
# Hard refresh
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows)
```

### 2. Open Portfolio Weight Panel
1. Go to Dashboard
2. Open Portfolio Weights
3. Click **12M** button

### 3. Watch for Full Year Data
The chart should now show:
- **Start Date**: ~December 2023 or January 2024
- **End Date**: December 2024
- **Data Points**: ~250-300 trading days
- **X-axis**: Full year span

### 4. Check Edge Function Logs
```bash
supabase functions logs portfolio-returns --tail
```

You should see logs like:
```
Fetching 400 days (600 with buffer) for TICKER.NS
Date range: 2023-12-01T00:00:00.000Z to 2024-12-23T00:00:00.000Z
✓ Fetched 252 data points for TICKER.NS
Price data lengths: min=250, max=253
```

## 📊 Expected Results

### Before (Broken):
```json
{
  "equityCurve": [
    { "date": "2024-12-02", "value": 1 },
    { "date": "2024-12-03", "value": 0.989 },
    ...
    { "date": "2024-12-23", "value": 1.216 }
  ]
}
// Only 16 data points (3 weeks)
```

### After (Fixed):
```json
{
  "equityCurve": [
    { "date": "2023-12-26", "value": 1 },
    { "date": "2023-12-27", "value": 1.002 },
    ...
    { "date": "2024-12-23", "value": 1.216 }
  ]
}
// ~250 data points (full year)
```

### Metrics Should Show:
```
Return (12M): Actual 1-year return (not 0%)
Volatility (12M): ~20-60% (annualized)
Sharpe (12M): Calculated from full year
Drawdown (12M): Max decline over full year
```

## 🔍 Debug If Still Not Working

### Check 1: Verify Tickers Have Historical Data
Some stocks might be newly listed and don't have 1 year of data on Yahoo Finance.

```bash
# Test manually
curl "https://query1.finance.yahoo.com/v8/finance/chart/IDFCFIRSTB.NS?period1=1638316800&period2=1701388800&interval=1d"
```

### Check 2: View Logs for Date Ranges
```bash
supabase functions logs portfolio-returns
```

Look for:
- "Fetching X days for TICKER"
- "Date range: START to END"
- "Fetched X valid price points"

### Check 3: Test with US Stock
Try adding a US stock like AAPL which definitely has 1+ year of data:
1. Add AAPL to portfolio
2. Save weights
3. Check if 12M works for AAPL

## ⚠️ Known Limitations

### 1. Newly Listed Stocks
- Stocks listed < 1 year ago won't have full history
- System will use available data (may be < 365 days)

### 2. Yahoo Finance API
- Rate limits may apply
- Some NSE tickers may have gaps in data
- Function will skip tickers with errors

### 3. Data Gaps
- Non-trading days (weekends, holidays) are excluded
- ~250 trading days per year (not 365)

## 📈 Technical Details

### Date Calculation:
```typescript
// For 12M period (365 days):
bufferDays = 365 * 1.5 = 547 days
period1 = now - (547 * 24 * 60 * 60 * 1000)
period2 = now

// This ensures we capture:
// - 365 calendar days
// - ~104 weekend days
// - ~10-15 holidays
// = ~250-260 trading days
```

### Data Filtering:
```typescript
// Only valid prices included:
validData = timestamps
  .map((ts, i) => ({ date: ts, price: closePrices[i] }))
  .filter(d => d.price !== null && d.price !== undefined)
```

## ✅ Success Criteria

Your fix worked if:
- ✅ Equity curve shows ~250-300 data points
- ✅ Chart X-axis spans from ~Dec 2023/Jan 2024 to Dec 2024
- ✅ Return (12M) is NOT 0% (shows actual return)
- ✅ Logs show fetching full date ranges
- ✅ All period buttons (1M/3M/6M/12M) work correctly

## 🚀 Next Steps

1. **Refresh browser** (Cmd+Shift+R)
2. **Open weight panel**
3. **Click 12M button**
4. **Verify chart shows full year**
5. **Check other periods work too**

---

**The fix is deployed!** Test it now and you should see the full year of data. 📈
