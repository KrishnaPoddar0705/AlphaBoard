# Security Setup Guide

This guide explains how to securely manage secrets for this application using Supabase secrets and environment variables.

## ⚠️ CRITICAL: Exposed Secrets in Git History

**IMPORTANT**: The following secrets were found in git history and MUST be rotated immediately:

1. **OPENAI_API_KEY** - Rotate at: https://platform.openai.com/api-keys
2. **SUPABASE_SERVICE_KEY** - Rotate at: https://app.supabase.com/project/_/settings/api
3. **FINNHUB_API_KEY** - Rotate at: https://finnhub.io/account
4. **VITE_SUPABASE_ANON_KEY** - While anon keys are meant to be public-facing, consider rotating if concerned

### Steps to Rotate Secrets:

1. Generate new API keys from each service
2. Update Supabase secrets (see below)
3. Update local `.env` files
4. Update any CI/CD environment variables
5. Test that all functionality still works

## Environment Variables Overview

### Frontend (React/Vite)
- **Location**: `frontend/.env` (NOT committed to git)
- **Required Variables**:
  - `VITE_SUPABASE_URL` - Your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Backend (Python/FastAPI)
- **Location**: `backend/.env` (NOT committed to git)
- **Required Variables**:
  - `OPENAI_API_KEY` - For AI thesis generation
  - `SUPABASE_URL` - Your Supabase project URL
  - `SUPABASE_SERVICE_KEY` - Your Supabase service role key (keep secret!)
- **Optional Variables**:
  - `FINNHUB_API_KEY` - For stock search
  - `NEWSAPI_KEY` - For news aggregation
  - `NOTION_API_KEY` - For Notion export
  - `NOTION_DATABASE_ID` - For Notion export

### Edge Functions (Deno)
- **Location**: Supabase Secrets (configured via Supabase Dashboard)
- **Required Secrets**:
  - `SUPABASE_URL` - Your Supabase project URL
  - `SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Setting Up Supabase Secrets for Edge Functions

Edge functions use Supabase's built-in secrets management. These are automatically available via `Deno.env.get()`.

### Steps to Configure:

1. **Go to Supabase Dashboard**
   - Navigate to: https://app.supabase.com/project/_/settings/functions
   - Or: Project Settings → Edge Functions → Secrets

2. **Add Required Secrets**
   ```bash
   # Using Supabase CLI
   supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
   supabase secrets set SUPABASE_ANON_KEY=your-anon-key-here
   ```

   Or via Dashboard:
   - Click "Add Secret"
   - Name: `SUPABASE_URL`
   - Value: Your Supabase project URL (e.g., `https://odfavebjfcwsovumrefx.supabase.co`)
   - Click "Add Secret" again
   - Name: `SUPABASE_ANON_KEY`
   - Value: Your Supabase anonymous key

3. **Verify Secrets**
   ```bash
   supabase secrets list
   ```

### Edge Functions That Use Secrets:

- `get-weights` - Uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `save-weights` - Uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `rebalance` - No secrets required (pure calculation)
- `portfolio-returns` - Uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`

## Local Development Setup

### 1. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your actual values
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your actual values
```

### 3. Verify .gitignore

Ensure `.gitignore` includes:
```
.env
.env.local
.env.*.local
*.env
!*.env.example
```

## Production Deployment

### Frontend (Vite)
- Set environment variables in your hosting platform (Vercel, Netlify, etc.)
- Prefix with `VITE_` for Vite to expose them to the client

### Backend (FastAPI)
- Set environment variables in your hosting platform
- Use platform-specific secret management (e.g., Railway, Render, AWS Secrets Manager)

### Edge Functions
- Secrets are managed via Supabase Dashboard
- No `.env` files needed - secrets are automatically injected

## Security Best Practices

1. ✅ **Never commit `.env` files** - They're in `.gitignore`
2. ✅ **Use `.env.example` files** - Document required variables without values
3. ✅ **Rotate exposed secrets** - If found in git history, rotate immediately
4. ✅ **Use Supabase secrets** - For edge functions, use Supabase's built-in secret management
5. ✅ **Limit service keys** - Only use service role keys server-side, never client-side
6. ✅ **Use anon keys client-side** - Anon keys are safe for frontend use (with RLS policies)

## Checking for Exposed Secrets

To check git history for exposed secrets:

```bash
# Check for API keys in git history
git log --all --source --full-history -p -- "*/.env" | grep -E "(API_KEY|SECRET|PASSWORD|TOKEN)"

# Check for committed .env files
git ls-files | grep "\.env"
```

## Troubleshooting

### Edge Functions Can't Access Secrets

1. Verify secrets are set: `supabase secrets list`
2. Check secret names match exactly (case-sensitive)
3. Redeploy edge functions after setting secrets
4. Check function logs in Supabase Dashboard

### Frontend Can't Connect to Supabase

1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
2. Check browser console for errors
3. Verify values match Supabase Dashboard settings

### Backend Can't Connect to Supabase

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
2. Check `.env` file exists in `backend/` directory
3. Verify service key has correct permissions

