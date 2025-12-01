# 🔧 Fix: Weights Not Saving Correctly

## ❌ The Problem
Weights were being sent to the old FastAPI endpoint (`http://127.0.0.1:8000/api/portfolio/weights/`) and saved as 0.0, instead of going to the new Edge Functions.

## 🔍 Root Cause
Dashboard was importing the **WRONG** component:
```typescript
// ❌ OLD (wrong)
import { PortfolioWeightPanelV2 } from '../components/portfolio/PortfolioWeightPanel';

// ✅ NEW (correct)  
import { PortfolioWeightPanelV2 } from '../components/portfolio/PortfolioWeightPanelV2';
```

## ✅ What Was Fixed
Changed the import in `Dashboard.tsx` to use the correct V2 component that calls Edge Functions.

## 📊 Data Flow Comparison

### Before (Broken):
```
Dashboard → PortfolioWeightPanel (old) 
  → FastAPI updatePortfolioWeights() 
  → Saves to recommendations.weight_pct (0.0)
  → ❌ analyst_portfolio_weights table remains empty
```

### After (Fixed):
```
Dashboard → PortfolioWeightPanelV2 (new)
  → Edge Functions saveWeights()
  → Saves to analyst_portfolio_weights table
  → ✅ portfolio-returns calculates metrics
```

## 🧪 How to Test the Fix

### 1. Restart Frontend
```bash
cd /Users/krishna.poddar/leaderboard/frontend
npm run dev
```

### 2. Test Weight Saving
1. Go to Dashboard
2. Open Portfolio Weight Panel
3. Adjust weights
4. Click "Save"
5. Check browser console for Edge Function calls

### 3. Verify in Supabase
Go to Supabase → Table Editor → `analyst_portfolio_weights`

You should now see rows like:
```
| user_id | ticker | weight_pct | updated_at |
|---------|--------|------------|------------|
| d7a58... | TICKER.NS | 8.33 | 2025-12-01... |
```

### 4. Verify Edge Function Logs
```bash
supabase functions logs save-weights --tail
```

You should see:
```
Successfully saved X weights for user d7a58b50-31e4-4214-9612-f18a45cb9afe
```

## 📝 Files Changed
1. `frontend/src/pages/Dashboard.tsx` - Fixed import path
2. `frontend/src/components/portfolio/PortfolioWeightPanelV2.tsx` - Auto-save on open
3. `frontend/src/components/portfolio/PerformancePreviewV2.tsx` - Better error handling

## ✅ Expected Behavior Now

### When Opening Weight Panel:
1. Loads OPEN positions
2. Auto-saves default equal weights to Edge Function
3. `analyst_portfolio_weights` table gets populated
4. Performance metrics load automatically

### When Adjusting Weights:
1. Slider moves → Rebalance Edge Function called
2. Click Save → saveWeights Edge Function called
3. Data persists to `analyst_portfolio_weights`
4. Performance recalculates with new weights

### When Viewing Performance:
1. Calls `portfolio-returns` Edge Function
2. Fetches weights from `analyst_portfolio_weights`
3. Fetches prices from Yahoo Finance
4. Calculates fresh metrics (no cache!)

## 🎯 Success Criteria
- ✅ No calls to `http://127.0.0.1:8000/api/portfolio/weights/`
- ✅ Calls to `https://odfavebjfcwsovumrefx.supabase.co/functions/v1/save-weights`
- ✅ Weights appear in `analyst_portfolio_weights` table
- ✅ Performance metrics load correctly
- ✅ No more 0.0 weights

## 🚀 Next Steps
1. Restart frontend
2. Test weight saving
3. Verify in Supabase database
4. Check Edge Function logs
5. Confirm performance metrics load

---

**The fix is complete!** Restart your frontend to use the correct V2 component. 🎉
