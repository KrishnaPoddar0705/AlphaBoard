# Supabase Edge Functions Setup

## Overview
This directory contains Supabase Edge Functions for real-time portfolio calculations.

## Edge Functions

1. **save-weights** - Save portfolio weights to database
2. **get-weights** - Retrieve portfolio weights
3. **rebalance** - Rebalance weights proportionally  
4. **portfolio-returns** - Calculate returns, Sharpe, volatility, drawdown (ALWAYS FRESH)

## Prerequisites

1. Install Supabase CLI:
```bash
brew install supabase/tap/supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link to your project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## Deploy Edge Functions

Deploy all functions:
```bash
supabase functions deploy save-weights
supabase functions deploy get-weights
supabase functions deploy rebalance
supabase functions deploy portfolio-returns
```

Or deploy all at once:
```bash
supabase functions deploy
```

## Set Environment Variables

The functions need these environment variables (automatically set by Supabase):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Local Development

Start Supabase locally:
```bash
supabase start
```

Serve functions locally:
```bash
supabase functions serve save-weights
supabase functions serve get-weights
supabase functions serve rebalance
supabase functions serve portfolio-returns
```

Or serve all:
```bash
supabase functions serve
```

## Testing Edge Functions

Test save-weights:
```bash
curl -X POST 'http://localhost:54321/functions/v1/save-weights' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "userId": "user-uuid",
    "weights": [
      {"ticker": "IDFCFIRSTB.NS", "weight": 14.8},
      {"ticker": "RKFORGE.NS", "weight": 8.3}
    ]
  }'
```

Test get-weights:
```bash
curl 'http://localhost:54321/functions/v1/get-weights?userId=user-uuid' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

Test rebalance:
```bash
curl -X POST 'http://localhost:54321/functions/v1/rebalance' \
  -H 'Content-Type: application/json' \
  -d '{
    "currentWeights": [
      {"ticker": "IDFCFIRSTB.NS", "weight": 14.8},
      {"ticker": "RKFORGE.NS", "weight": 8.3}
    ],
    "targetTicker": "IDFCFIRSTB.NS",
    "newWeight": 20.0
  }'
```

Test portfolio-returns:
```bash
curl -X POST 'http://localhost:54321/functions/v1/portfolio-returns' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"userId": "user-uuid"}'
```

## Database Migration

Run the migration to create the `analyst_portfolio_weights` table:

```bash
psql -h YOUR_DB_HOST -U postgres -d postgres < database/migration_create_portfolio_weights.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Paste contents of `migration_create_portfolio_weights.sql`
3. Run

## Important Notes

- **NO CACHING**: All performance metrics are calculated fresh every time
- **Weight Validation**: Weights must sum to 100% (±0.1%)
- **Fresh Data**: Yahoo Finance API fetches latest prices
- **RLS Enabled**: Users can only access their own weights
- **Edge Computing**: Functions run close to users for low latency

## Monitoring

View function logs:
```bash
supabase functions logs save-weights
supabase functions logs portfolio-returns
```

## Troubleshooting

**Function not deploying:**
- Check you're linked to the correct project
- Verify Supabase CLI is up to date
- Check function syntax with `deno check index.ts`

**Yahoo Finance API failing:**
- Verify ticker symbols are correct (.NS for NSE, .BO for BSE)
- Check network connectivity
- Consider rate limiting (add delays if needed)

**Weights not saving:**
- Check RLS policies
- Verify user is authenticated
- Check weights sum to 100%

