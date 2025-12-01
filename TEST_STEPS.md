# 🧪 Testing Steps - Portfolio Weight System

## Current Status
✅ Edge Functions deployed
✅ Database migrated
✅ Frontend configured
✅ Auto-save default weights implemented

## Step-by-Step Test

### 1. Restart Frontend
```bash
cd /Users/krishna.poddar/leaderboard/frontend
npm run dev
```

### 2. Add Recommendations First
Before testing weights, make sure you have some OPEN recommendations:

1. Go to Dashboard
2. Search for a stock (e.g., "IDFCFIRSTB.NS")
3. Add recommendation:
   - Action: BUY
   - Entry Price: current price
   - Status: OPEN
4. Add 2-3 more stocks

### 3. Open Portfolio Weight Panel
1. Click the "Portfolio Weights" or settings button
2. Panel should open on the right side

**Expected:**
- ✅ Shows all your OPEN positions
- ✅ Default equal weights (e.g., if 4 stocks, each = 25%)
- ✅ Weights auto-save immediately (check console for "Auto-saving default equal weights")
- ✅ Performance preview starts loading

### 4. Test Weight Adjustment
1. Drag a slider to change a weight (e.g., from 25% to 40%)
2. Watch other weights auto-adjust
3. Total should always show 100%

**Expected:**
- ✅ Other sliders move automatically
- ✅ Debounced rebalance call (after ~800ms)
- ✅ Performance preview updates after adjustment

### 5. Test Manual Input Mode
1. Click "Manual Input Mode" toggle
2. Type exact percentages (e.g., 30, 30, 20, 20)
3. Click "Save"

**Expected:**
- ✅ Input boxes appear
- ✅ Can type decimal values
- ✅ Shows total weight at bottom
- ✅ Auto-normalizes to 100% on save
- ✅ Success message: "Weights saved successfully!"

### 6. Verify Performance Metrics
After saving weights, check the performance preview:

**Expected:**
- ✅ Shows 1M, 3M, 6M, 12M return cards
- ✅ Shows Volatility, Sharpe Ratio, Max Drawdown
- ✅ Shows portfolio performance chart
- ✅ All values are calculated fresh from Yahoo Finance

### 7. Verify in Database
```bash
# Check saved weights
supabase db query "SELECT * FROM analyst_portfolio_weights WHERE user_id = 'YOUR_USER_ID';"

# Expected: Rows for each ticker with weights that sum to ~100%
```

### 8. Test Performance Calculation
```bash
# View Edge Function logs
supabase functions logs portfolio-returns --tail
```

Open Performance Preview and watch logs for:
- Fetching weights from DB
- Fetching prices from Yahoo Finance
- Calculating metrics

## Common Issues & Solutions

### Issue: "No portfolio weights found"
**Solution:** 
- Weight panel now AUTO-SAVES default equal weights when opened
- If you see this error, close and reopen the panel
- Check browser console for "Auto-saving default equal weights"

### Issue: "Failed to fetch price data"
**Possible causes:**
1. Invalid ticker format
   - Use `.NS` for NSE stocks (e.g., `IDFCFIRSTB.NS`)
   - Use `.BO` for BSE stocks
2. Yahoo Finance API rate limit
   - Wait a few seconds and try again
3. Ticker doesn't exist on Yahoo Finance
   - Test with a known ticker like `AAPL` or `RELIANCE.NS`

### Issue: Weights don't save
**Check:**
1. Browser console for errors
2. Network tab for API calls
3. Edge Function logs: `supabase functions logs save-weights`

### Issue: Performance takes too long
**Expected:** 2-5 seconds for fresh calculation
- First call may be slower (cold start)
- Subsequent calls should be faster

## Success Criteria

Your system works if:
- ✅ Default weights auto-save when panel opens
- ✅ Weight adjustments work smoothly
- ✅ Total always equals 100%
- ✅ Performance metrics load (even if it takes a few seconds)
- ✅ Charts display correctly
- ✅ No CORS errors in console
- ✅ Weights persist in database

## Advanced Testing

### Test with Different Portfolios
1. Test with 1 stock (should be 100%)
2. Test with 2 stocks (should be 50/50)
3. Test with 10+ stocks (should handle gracefully)

### Test Edge Cases
1. Try setting a weight to 0%
2. Try setting a weight to 100%
3. Add a new recommendation (should auto-rebalance)
4. Remove a recommendation (should update weights)

### Performance Stress Test
1. Add 20+ recommendations
2. Open weight panel
3. Adjust multiple weights
4. Check if UI remains responsive

## Need Help?

Check logs:
```bash
# Frontend console (browser DevTools)
# Edge Function logs
supabase functions logs portfolio-returns --tail

# Database
supabase db query "SELECT * FROM analyst_portfolio_weights;"
```

View documentation:
- `DEPLOYMENT_COMPLETE.md` - Full deployment guide
- `QUICK_START.md` - Quick reference
- `IMPLEMENTATION_SUMMARY.md` - Technical details
