# 📊 How to View 1-Year Portfolio Performance

## Current Issue
Your chart is showing only ~3 weeks of data (Dec 6 - Dec 23), but you want to see the full **12-month (1 year)** performance.

## ✅ Solution: Click the 12M Button

### Step 1: Look at the Top of the Performance Panel
You should see 4 period buttons:
```
[1M]  [3M]  [6M]  [12M]
```

### Step 2: Click "12M"
- The **12M** button should turn **blue/indigo** when selected
- The chart will update to show the full year
- All metrics (Return, Volatility, Sharpe, Drawdown) will update for 12 months

### Step 3: Wait for Data to Load
- The Edge Function fetches 365 days of price history
- This may take 2-5 seconds
- You'll see a loading animation while it calculates

## 📈 What You Should See After Clicking 12M

### Chart X-Axis:
```
Before: 2024-12-06 → 2024-12-23 (3 weeks)
After:  2024-01-01 → 2024-12-23 (12 months)
```

### Metrics Update:
```
Return (12M): Your full year return
Volatility (12M): Annualized volatility for the year
Sharpe (12M): Risk-adjusted return for the year
Drawdown (12M): Worst decline over the year
```

### Chart:
- Should show ~250-300 data points (one per trading day)
- Full equity curve from January to December 2024

## 🔍 If 12M Button Doesn't Appear

### Check 1: Is the Performance Panel Open?
1. Go to Dashboard
2. Click the Portfolio Weights button (gear icon or settings)
3. Look for the Performance Preview section at the top

### Check 2: Restart Frontend
```bash
cd /Users/krishna.poddar/leaderboard/frontend
npm run dev
```

### Check 3: Check Browser Console
1. Open Chrome DevTools (F12)
2. Look for any errors
3. Check Network tab for Edge Function calls

## 🧪 Test the Period Selector

### Try Each Period:
1. **Click 1M** → Should show ~30 days (Nov 23 - Dec 23)
2. **Click 3M** → Should show ~90 days (Sep 23 - Dec 23)
3. **Click 6M** → Should show ~180 days (Jun 23 - Dec 23)
4. **Click 12M** → Should show ~365 days (Jan 23 - Dec 23)

### Watch the Chart Update:
- X-axis dates should change
- Chart should show more/less data points
- Metrics should recalculate

## ⚠️ Possible Issues

### Issue 1: Not Enough Historical Data
**Symptom:** Chart still shows limited data even after clicking 12M

**Cause:** Some tickers might not have 1 year of price history on Yahoo Finance

**Solution:** 
- Check which tickers are in your portfolio
- Newly listed stocks may have <1 year of data
- The function will show as much data as available

### Issue 2: Loading Takes Too Long
**Symptom:** Metrics show 0.00% or loading never completes

**Cause:** Yahoo Finance API rate limiting or network issues

**Solution:**
1. Wait 30 seconds and try again
2. Check Edge Function logs:
   ```bash
   supabase functions logs portfolio-returns --tail
   ```
3. Look for errors in the logs

### Issue 3: Period Button Not Working
**Symptom:** Clicking buttons doesn't update chart

**Cause:** Frontend not passing period parameter

**Solution:**
1. Clear browser cache (Cmd+Shift+R)
2. Restart frontend dev server
3. Check console for JavaScript errors

## 🎯 Expected Full Year Performance

When 12M is working correctly, you should see:

```
Portfolio Performance
[1M] [3M] [6M] [12M] ← 12M should be highlighted

Chart showing:
- Start: ~2024-01-01 (or earliest available)
- End: 2024-12-23
- Full equity curve over the year
- Y-axis: -9% to 27% (based on your portfolio)

Return (12M): +XX.XX% (your actual 1-year return)
Volatility (12M): XX.XX% (annualized)
Sharpe (12M): X.XX (risk-adjusted)
Drawdown (12M): -X.XX% (worst decline)
```

## 📞 Still Not Working?

### Debug Steps:
1. Check browser console for errors
2. Verify weights are saved in database
3. Check Edge Function logs
4. Try with a different browser
5. Ensure internet connection is stable

### Quick Test:
```bash
# Test Edge Function directly
curl -X POST 'https://odfavebjfcwsovumrefx.supabase.co/functions/v1/portfolio-returns' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "userId": "d7a58b50-31e4-4214-9612-f18a45cb9afe",
    "period": "12M"
  }'
```

This should return data with ~365 days of equity curve.

---

**TL;DR:** Click the **12M** button at the top of the performance panel to see 1 year of data! 🚀
