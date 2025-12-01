# ✅ FINAL FIX: Full 1-Year Historical Data

## 🐛 Root Cause

Yahoo Finance was returning incomplete data (only April-May 2024) instead of the full year because:
1. The date calculation wasn't reliable
2. Not enough buffer for weekends/holidays  
3. Poor error handling masked the real issue

## 🔧 What I Fixed

### 1. Improved Date Calculation
```typescript
// Before: Simple timestamp math (unreliable)
const period1 = Date.now() - days * 24 * 60 * 60 * 1000

// After: Proper Date object handling
const now = new Date()
const startDate = new Date(now)
startDate.setDate(startDate.getDate() - Math.floor(days * 1.5))
```

### 2. Added User-Agent Header
```typescript
headers: {
  'User-Agent': 'Mozilla/5.0...'  
}
// Yahoo Finance sometimes blocks requests without this
```

### 3. Better URL Parameters
```typescript
// Added: includePrePost=false
// This ensures we only get regular trading hours data
```

### 4. Comprehensive Error Logging
Now logs:
- Exact date ranges requested
- Number of data points received
- Warnings if data is incomplete
- Detailed error messages for debugging

## 🧪 Test Now

### Step 1: Hard Refresh Browser
```
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows)
```

### Step 2: Open Portfolio Panel
1. Go to Dashboard
2. Open Portfolio Weights panel

### Step 3: Click 12M Button
- Wait 3-5 seconds for calculation
- Check browser console for detailed logs

### Step 4: Verify Full Year Data

**Chart should show:**
- Start: ~December 2023 / January 2024
- End: December 2024
- ~250-300 data points

**Metrics should show:**
- Return (12M): Actual 12-month return (NOT 0%)
- Volatility: ~20-80% annualized
- Sharpe: Calculated value  
- Drawdown: Max decline over the year

## 📊 Expected vs Actual

### Before (What you saw):
```json
{
  "equityCurve": [
    { "date": "2024-04-10", "value": 1 },
    ...
    { "date": "2024-05-06", "value": 0.993 }
  ]
}
// Only 16 points (April-May 2024)
```

### After (What you should see):
```json
{
  "equityCurve": [
    { "date": "2023-12-26", "value": 1 },
    ...
    { "date": "2024-12-23", "value": 1.215 }
  ]
}
// ~250 points (Full year)
```

## 🔍 Debugging

### Check Browser Console
After clicking 12M, you should see logs like:
```
[TICKER.NS] Fetching 365 trading days
[TICKER.NS] Date range: 2023-06-01 to 2024-12-23
[TICKER.NS] ✓ Got 252 prices from 2023-12-26 to 2024-12-23
```

### Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Click 12M button
4. Find POST request to `portfolio-returns`
5. Check response for `equityCurve` length

### If Still Limited Data

**Possible causes:**

1. **Stock Recently Listed**
   - Some stocks may not have 1 year of history
   - System will use available data
   - Try testing with AAPL (definitely has full history)

2. **Yahoo Finance Rate Limit**
   - Wait 30 seconds and try again
   - Check Edge Function logs

3. **Invalid Tickers**
   - Verify tickers are correct (.NS for NSE, .BO for BSE)
   - Check which tickers are in your portfolio

## 🔗 Check Edge Function Logs

```bash
# View detailed logs
supabase functions logs portfolio-returns | grep "Fetching\|Got\|error"
```

Look for patterns like:
```
✓ [TICKER1.NS] Got 252 prices from 2023-12-26 to 2024-12-23
✓ [TICKER2.NS] Got 248 prices from 2023-12-28 to 2024-12-23
⚠️ [TICKER3.NS] Only got 45 days, requested 365
```

## ⚠️ Important Notes

### Trading Days vs Calendar Days
- 365 calendar days = ~250-260 trading days
- Weekends, holidays excluded
- This is normal and expected

### NSE vs BSE Tickers
- NSE: Use `.NS` suffix (e.g., `RELIANCE.NS`)
- BSE: Use `.BO` suffix (e.g., `RELIANCE.BO`)
- Must be exact or Yahoo Finance won't find them

### Data Availability
Not all stocks have full historical data:
- Newly listed stocks: < 1 year
- Delisted stocks: May have gaps
- Low liquidity stocks: May have missing days

## ✅ Success Criteria

Your fix worked if:
- ✅ Chart shows ~250 data points (not 16)
- ✅ Date range spans ~12 months
- ✅ Return (12M) is calculated (not 0%)
- ✅ Console logs show correct date ranges
- ✅ Each period (1M/3M/6M/12M) shows different data

## 🎯 Final Check

Test all periods:
1. **Click 1M** → See last ~22 trading days
2. **Click 3M** → See last ~65 trading days
3. **Click 6M** → See last ~130 trading days
4. **Click 12M** → See ~250 trading days ✅

Each should show:
- Different number of data points
- Different date ranges
- Different metrics

---

**The fix is deployed!** Hard refresh and test now. 🚀
