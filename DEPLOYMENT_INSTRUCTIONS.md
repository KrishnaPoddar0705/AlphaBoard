# 🚀 Deployment Instructions - Edge Functions

## ⚠️ IMPORTANT: Edge Functions Must Be Deployed First!

The CORS error you're seeing means the Edge Functions haven't been deployed to Supabase yet. Follow these steps:

## Step-by-Step Deployment

### 1. Install Supabase CLI

```bash
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

### 2. Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication.

### 3. Link Your Project

```bash
cd /Users/krishna.poddar/leaderboard

supabase link --project-ref odfavebjfcwsovumrefx
```

Note: `odfavebjfcwsovumrefx` is your project ref (from the error URL)

### 4. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy save-weights
supabase functions deploy get-weights
supabase functions deploy rebalance
supabase functions deploy portfolio-returns
```

Expected output:
```
Deploying function save-weights...
✓ Deployed function save-weights (build_id: xxx)

Deploying function get-weights...
✓ Deployed function get-weights (build_id: xxx)

Deploying function rebalance...
✓ Deployed function rebalance (build_id: xxx)

Deploying function portfolio-returns...
✓ Deployed function portfolio-returns (build_id: xxx)
```

### 5. Run Database Migration

Go to https://app.supabase.com → Your Project → SQL Editor

Copy/paste the contents of:
`database/migration_create_portfolio_weights.sql`

Click "Run"

### 6. Verify Deployment

Test the functions:

```bash
# Get your anon key from Supabase Dashboard → Settings → API
export ANON_KEY="your_anon_key_here"

# Test save-weights
curl -X POST 'https://odfavebjfcwsovumrefx.supabase.co/functions/v1/save-weights' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{
    "userId": "test",
    "weights": [
      {"ticker": "IDFCFIRSTB.NS", "weight": 50},
      {"ticker": "RKFORGE.NS", "weight": 50}
    ]
  }'
```

Expected: `{"success": true, ...}`

### 7. Update Frontend .env

Create/update `frontend/.env`:

```env
VITE_SUPABASE_URL=https://odfavebjfcwsovumrefx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Get your anon key from: Supabase Dashboard → Settings → API → Project API keys → `anon` `public`

### 8. Restart Frontend

```bash
cd /Users/krishna.poddar/leaderboard/frontend
npm run dev
```

## Troubleshooting

### "supabase: command not found"
```bash
brew install supabase/tap/supabase
```

### "Project not linked"
```bash
supabase link --project-ref odfavebjfcwsovumrefx
```

### "Unauthorized" when deploying
```bash
supabase logout
supabase login
```

### CORS errors persist
1. Verify functions are deployed:
   ```bash
   supabase functions list
   ```
   
2. Check function URLs in Supabase Dashboard → Edge Functions

3. Verify CORS headers in function code (already included)

### Edge Function errors
View logs:
```bash
supabase functions logs portfolio-returns --tail
```

## Quick Test Script

Save this as `test-edge-functions.sh`:

```bash
#!/bin/bash

# Configuration
PROJECT_URL="https://odfavebjfcwsovumrefx.supabase.co"
ANON_KEY="YOUR_ANON_KEY_HERE"
USER_ID="test-user-123"

# Test save-weights
echo "Testing save-weights..."
curl -X POST "$PROJECT_URL/functions/v1/save-weights" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"weights\": [
      {\"ticker\": \"IDFCFIRSTB.NS\", \"weight\": 50},
      {\"ticker\": \"RKFORGE.NS\", \"weight\": 50}
    ]
  }"

echo -e "\n\nTesting get-weights..."
curl "$PROJECT_URL/functions/v1/get-weights?userId=$USER_ID" \
  -H "Authorization: Bearer $ANON_KEY"

echo -e "\n\nTesting portfolio-returns..."
curl -X POST "$PROJECT_URL/functions/v1/portfolio-returns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "{\"userId\": \"$USER_ID\"}"
```

Make executable and run:
```bash
chmod +x test-edge-functions.sh
./test-edge-functions.sh
```

## After Deployment

Once functions are deployed:
1. Refresh your frontend app
2. Open Portfolio Weights panel
3. Adjust weights
4. Click Save
5. Performance should load automatically

## Need Help?

Check these files:
- `QUICK_START.md` - Quick deployment guide
- `IMPLEMENTATION_SUMMARY.md` - Full technical details
- `supabase/README.md` - Edge Functions reference

Or check logs:
```bash
supabase functions logs portfolio-returns
```

