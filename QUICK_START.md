# Quick Start - Edge Functions Portfolio System

## 🚀 What's Been Implemented

### ✅ Complete Edge Functions Architecture
- 4 serverless functions (Deno/TypeScript)
- New database table for weights
- Frontend components (V2)
- Zero caching - all metrics calculated fresh
- Yahoo Finance integration for live prices

### 📁 Files Created (12 files)

**Database:**
1. `database/migration_create_portfolio_weights.sql` - Creates weights table, drops cache tables

**Edge Functions:**
2. `supabase/functions/save-weights/index.ts` - Save portfolio weights
3. `supabase/functions/get-weights/index.ts` - Get portfolio weights  
4. `supabase/functions/rebalance/index.ts` - Rebalance weights
5. `supabase/functions/portfolio-returns/index.ts` - Calculate performance (FRESH)

**Frontend:**
6. `frontend/src/lib/edgeFunctions.ts` - API client
7. `frontend/src/components/portfolio/PortfolioWeightPanelV2.tsx` - New weight UI
8. `frontend/src/components/portfolio/PerformancePreviewV2.tsx` - New performance UI

**Documentation:**
9. `supabase/README.md` - Edge Functions deployment guide
10. `EDGE_FUNCTIONS_SETUP.md` - Complete setup instructions
11. `IMPLEMENTATION_SUMMARY.md` - Detailed implementation docs
12. `QUICK_START.md` - This file

## ⚡ Deploy in 5 Minutes

### Step 1: Install Supabase CLI
```bash
brew install supabase/tap/supabase
supabase --version
```

### Step 2: Login & Link
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in Supabase Dashboard → Settings → API

### Step 3: Run Database Migration
**Option A:** Via Dashboard
1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Copy/paste `database/migration_create_portfolio_weights.sql`
3. Click "Run"

**Option B:** Via psql
```bash
psql -h YOUR_DB_HOST -U postgres -d postgres < database/migration_create_portfolio_weights.sql
```

### Step 4: Deploy Edge Functions
```bash
cd /Users/krishna.poddar/leaderboard
supabase functions deploy save-weights
supabase functions deploy get-weights
supabase functions deploy rebalance
supabase functions deploy portfolio-returns
```

Expected output:
```
✓ Deployed function save-weights
✓ Deployed function get-weights
✓ Deployed function rebalance
✓ Deployed function portfolio-returns
```

### Step 5: Update Frontend
In `frontend/.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Get these from Supabase Dashboard → Settings → API

### Step 6: Use V2 Components
In your Dashboard or component:
```tsx
import { PortfolioWeightPanelV2 } from './components/portfolio/PortfolioWeightPanelV2';
import { PerformancePreviewV2 } from './components/portfolio/PerformancePreviewV2';

// Replace old components
<PortfolioWeightPanelV2 userId={userId} ... />
<PerformancePreviewV2 userId={userId} ... />
```

## 🧪 Test It Works

### 1. Test Save Weights
```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/save-weights' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "userId": "test-user-id",
    "weights": [
      {"ticker": "IDFCFIRSTB.NS", "weight": 50},
      {"ticker": "RKFORGE.NS", "weight": 50}
    ]
  }'
```

Expected: `{"success": true, ...}`

### 2. Test Get Weights
```bash
curl 'https://YOUR_PROJECT.supabase.co/functions/v1/get-weights?userId=test-user-id' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

Expected: `{"weights": [...], "totalWeight": 100}`

### 3. Test Portfolio Returns
```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/portfolio-returns' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"userId": "test-user-id"}'
```

Expected: `{"returns": {...}, "sharpe": ..., "volatility": ...}`

### 4. Verify in Database
```sql
SELECT * FROM analyst_portfolio_weights;
```

Should see your saved weights!

## 📊 How It Works

### User Saves Weights:
1. User drags slider → UI updates instantly
2. User clicks "Save" → Calls `save-weights` Edge Function
3. Edge Function validates (sum = 100%) → Saves to DB
4. Frontend refreshes → Calls `portfolio-returns`
5. Edge Function fetches Yahoo Finance prices → Calculates metrics
6. UI shows fresh performance data

### Performance Calculation Flow:
```
portfolio-returns Edge Function
  ↓
Fetch weights from DB (analyst_portfolio_weights)
  ↓
Fetch historical prices from Yahoo Finance API
  ↓
Calculate:
  - 1M, 3M, 6M, 12M returns
  - Volatility (std dev * sqrt(252))
  - Sharpe ratio ((return - 5%) / volatility)
  - Max drawdown (peak-to-trough)
  - Equity curve (daily portfolio value)
  ↓
Return JSON to frontend
  ↓
UI displays charts & metrics
```

## 🔍 Monitor & Debug

### View Logs
```bash
# Real-time logs
supabase functions logs portfolio-returns --tail

# Recent logs
supabase functions logs save-weights
```

### Check Database
```sql
-- See all weights
SELECT * FROM analyst_portfolio_weights;

-- Summary by user
SELECT * FROM portfolio_weights_summary;

-- Check if cache tables are gone
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'performance%';
-- Should return 0 rows
```

## ⚠️ Troubleshooting

### "Command not found: supabase"
```bash
brew install supabase/tap/supabase
```

### "Project not linked"
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### "Unauthorized" error
- Check `Authorization: Bearer YOUR_ANON_KEY` header
- Get key from Supabase Dashboard → Settings → API

### "Weights don't sum to 100%"
- Frontend automatically normalizes on save
- Edge Function validates ±0.1% tolerance

### Yahoo Finance failing
- Verify ticker format (e.g., `IDFCFIRSTB.NS` for NSE)
- Check if ticker exists on Yahoo Finance
- Try with a US ticker first: `AAPL`

## 📈 Next Steps

1. ✅ Deploy Edge Functions
2. ✅ Test with real user
3. Update all UI to use V2 components
4. Remove old FastAPI performance endpoints (optional)
5. Monitor Edge Function performance for a few days
6. Add error handling for Yahoo Finance rate limits (if needed)

## 🎯 Success Criteria

Your implementation works if:
- [ ] Weights save to `analyst_portfolio_weights` table
- [ ] Total weight always = 100%
- [ ] Performance metrics load in <3 seconds
- [ ] Charts display correctly
- [ ] Metrics change when weights change
- [ ] No caching (metrics always fresh)
- [ ] No errors in Edge Function logs

## 📞 Need Help?

Check these files:
- `IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `EDGE_FUNCTIONS_SETUP.md` - Detailed setup guide
- `supabase/README.md` - Edge Functions reference

Or check Supabase docs: https://supabase.com/docs/guides/functions

---

**You're all set!** 🎉  
Deploy, test, and enjoy real-time portfolio analytics!

