# ✅ DEPLOYED: Full Year Historical Data (v3)

## 🎯 What's Fixed

### Critical Fix: Proper Backward Date Calculation
```typescript
// Explicit backward calculation from TODAY
const endDate = new Date() // TODAY (Dec 1, 2024)
const startDate = new Date(endDate)
startDate.setDate(endDate.getDate() - calendarDaysNeeded) // Go BACK

// For 365 trading days, we need ~510 calendar days (1.4x buffer)
// Start: ~June 2023
// End: Dec 1, 2024
```

### Added Features:
1. ✅ **Retry Logic** - Handles "Too Many Requests" (429) errors
2. ✅ **Better Logging** - Shows exact date ranges and data points
3. ✅ **Sequential Fetching** - Avoids parallel rate limiting
4. ✅ **100ms Delays** - Between ticker requests

## 🚀 TEST NOW

### Step 1: Hard Refresh Browser
```
Cmd + Shift + R (Mac)  
Ctrl + Shift + R (Windows)
```

### Step 2: Open Portfolio Weight Panel
1. Dashboard → Portfolio Weights
2. Look at Performance Preview

### Step 3: Click 12M Button  
- Wait 5-10 seconds (fetching 1 year for each ticker)
- Check browser console (F12)

### Step 4: Expected Results

**Chart should show:**
```
Start: ~June 2023 / July 2023
End: December 2024
Data Points: ~250-300
```

**Metrics:**
```
Return (12M): Actual 12-month return
Volatility (12M): ~20-80% (annualized)
Sharpe (12M): Risk-adjusted return
Drawdown (12M): Max decline over the year
```

**Browser Console Logs:**
```
[BSE.NS] Requesting 365 trading days (511 calendar days)
[BSE.NS] Date range: 2023-06-15 to 2024-12-01
[BSE.NS] ✓ SUCCESS:
[BSE.NS]   - Data points: 252
[BSE.NS]   - Date range: 2023-12-01 to 2024-12-01
[BSE.NS]   - Calendar days: 366
[BSE.NS]   - Trading days: 252
```

## 📊 Your Current Portfolio

Based on database:
- **BSE.NS: 100%** (only active weight)
- Other tickers have 0% weight

**Note:** Since BSE.NS is 100%, your portfolio performance = BSE.NS performance

## ⚠️ Important: Fix Your Weights!

Currently all weights except BSE.NS are 0%. To see multi-stock portfolio:
1. Open Portfolio Weight Panel
2. Use sliders or manual input
3. Distribute weights across stocks
4. Click "Save"

Example for 12 stocks:
- Each stock: ~8.33%
- Total: 100%

## 🔍 Debug If Still Limited

### Check Edge Function Logs:
```bash
supabase functions logs portfolio-returns
```

Look for:
- `[BSE.NS] Date range:` - Should span ~1 year
- `[BSE.NS] ✓ SUCCESS` - Should show ~250 points
- Any errors or warnings

### If Still Seeing April-May Data:

**Cause:** Browser cache or old function version

**Solution:**
1. Close all browser tabs with your app
2. Wait 30 seconds
3. Open fresh tab
4. Hard refresh (Cmd+Shift+R)
5. Try 12M again

### Test with Multiple Stocks:

To verify it works with multiple tickers:
1. Set weights: BSE.NS = 50%, RELIANCE.NS = 50%
2. Save weights
3. Click 12M
4. Should fetch both stocks and show weighted performance

## ✅ Success Criteria

Works correctly if:
- ✅ Chart shows ~250-300 data points
- ✅ X-axis: ~Jun/Jul 2023 to Dec 2024
- ✅ Return (12M) is NOT 0%
- ✅ Console shows "Date range: 2023-XX-XX to 2024-12-01"
- ✅ All 4 periods (1M/3M/6M/12M) work

## 🎯 Quick Verification

Test sequence:
1. **Click 1M** → Chart shows Nov 2024 - Dec 2024
2. **Click 3M** → Chart shows Sep 2024 - Dec 2024
3. **Click 6M** → Chart shows Jun 2024 - Dec 2024
4. **Click 12M** → Chart shows Dec 2023 - Dec 2024 ✅

Each should show progressively more data!

---

**Latest version deployed!** Hard refresh and test now. 🚀

If you still see limited data, check Edge Function logs for detailed debugging info.
