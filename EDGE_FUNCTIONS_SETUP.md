# Edge Functions Implementation Guide

## What Changed?

We've migrated portfolio weight management and performance calculations to Supabase Edge Functions for:

1. **Real-time calculations** - No more stale cached data
2. **Better separation of concerns** - Portfolio logic in Edge Functions
3. **Scalability** - Edge Functions scale automatically
4. **Fresh market data** - Always fetches latest prices from Yahoo Finance

## Architecture

### Old System (FastAPI):
```
Frontend → FastAPI → PostgreSQL (with cached metrics)
```

### New System (Hybrid):
```
Frontend → Edge Functions → PostgreSQL (weights only)
                          ↓
                    Yahoo Finance API (prices)
```

FastAPI still handles: recommendations, leaderboard, user management, podcasts
Edge Functions handle: portfolio weights, returns, Sharpe, volatility, drawdown

## Files Created

### Database
- `database/migration_create_portfolio_weights.sql` - New weights table + drops cache tables

### Edge Functions (Deno/TypeScript)
- `supabase/functions/save-weights/index.ts` - Save weights
- `supabase/functions/get-weights/index.ts` - Get weights  
- `supabase/functions/rebalance/index.ts` - Rebalance weights
- `supabase/functions/portfolio-returns/index.ts` - Calculate returns (FRESH)

### Frontend
- `frontend/src/lib/edgeFunctions.ts` - Edge Functions API client
- `frontend/src/components/portfolio/PortfolioWeightPanelV2.tsx` - New weight panel
- `frontend/src/components/portfolio/PerformancePreviewV2.tsx` - New performance preview

## Deployment Steps

### 1. Database Migration
```bash
psql -h YOUR_DB_HOST -U postgres -d postgres < database/migration_create_portfolio_weights.sql
```

Or via Supabase Dashboard → SQL Editor

### 2. Deploy Edge Functions
```bash
cd /Users/krishna.poddar/leaderboard

# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy all functions
supabase functions deploy save-weights
supabase functions deploy get-weights
supabase functions deploy rebalance
supabase functions deploy portfolio-returns
```

### 3. Update Frontend Environment
Add to `.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Update Components
Replace old components with V2:
- Use `PortfolioWeightPanelV2` instead of `PortfolioWeightPanel`
- Use `PerformancePreviewV2` instead of `PerformancePreview`

## Testing

1. **Save Weights:**
   - Open weight panel
   - Adjust sliders or use manual input
   - Click "Save"
   - Verify in Supabase: `SELECT * FROM analyst_portfolio_weights WHERE user_id = 'YOUR_ID';`

2. **View Performance:**
   - Open Performance tab
   - Should see fresh metrics calculated from Yahoo Finance
   - Check browser console for Edge Function calls

3. **Rebalance:**
   - Drag a slider
   - Other weights should auto-adjust
   - Total should always be 100%

## Monitoring

View Edge Function logs:
```bash
supabase functions logs portfolio-returns --tail
```

## Rollback Plan

If Edge Functions fail:
1. Keep using old FastAPI endpoints temporarily
2. Check Edge Function logs for errors
3. Verify Yahoo Finance API is accessible
4. Check Supabase project status

## Known Limitations

1. **Yahoo Finance Rate Limits** - May need caching for high-traffic scenarios
2. **Cold Starts** - First request may be slower (Edge Function warmup)
3. **Historical Data** - Limited to what Yahoo Finance provides

## Next Steps

1. ✅ Deploy Edge Functions
2. ✅ Run database migration
3. ✅ Test weight saving
4. ✅ Verify performance calculations
5. ⏳ Monitor for a day
6. ⏳ Remove old caching code from FastAPI
7. ⏳ Update all UI components to use V2

## Support

- Edge Functions docs: https://supabase.com/docs/guides/functions
- Yahoo Finance API: https://finance.yahoo.com
- Supabase dashboard: https://app.supabase.com
