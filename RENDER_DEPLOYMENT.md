# Render.com Deployment Guide

This guide helps you deploy AlphaBoard on Render.com with proper configuration.

## Current Services

### Backend Service
- **Name**: AlphaBoard_Backend
- **URL**: https://alphaboard-backend.onrender.com
- **Type**: Web Service (Python/FastAPI)
- **ID**: srv-d4mvrpvpm1nc73d9jpvg

### Frontend Service
- **Name**: AlphaBoard
- **URL**: https://alphaboard.onrender.com
- **Type**: Static Site
- **ID**: srv-d4mvjl49c44c738cij60

## ⚠️ Configuration Issues to Fix

### Backend Service
**Current Start Command**: `uvicorn app.main:app --reload` ❌
**Should Be**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` ✅

**Fix via Dashboard**:
1. Go to: https://dashboard.render.com/web/srv-d4mvrpvpm1nc73d9jpvg
2. Click "Settings"
3. Scroll to "Start Command"
4. Change to: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Save changes

### Frontend Service
**Current Build Command**: `npm run dev` ❌
**Should Be**: `npm run build` ✅

**Current Publish Path**: `build` ❌
**Should Be**: `dist` ✅

**Fix via Dashboard**:
1. Go to: https://dashboard.render.com/static/srv-d4mvjl49c44c738cij60
2. Click "Settings"
3. Change "Build Command" to: `npm run build`
4. Change "Publish Path" to: `dist`
5. Save changes

## Environment Variables Setup

### ✅ Automatically Configured

**Frontend** (via script):
- ✅ `VITE_SUPABASE_URL` - `https://odfavebjfcwsovumrefx.supabase.co`
- ✅ `VITE_SUPABASE_ANON_KEY` - Set automatically

**Backend** (via script):
- ✅ `SUPABASE_URL` - `https://odfavebjfcwsovumrefx.supabase.co`

### ⚠️ Manual Setup Required

#### Backend Environment Variables

Add these in: https://dashboard.render.com/web/srv-d4mvrpvpm1nc73d9jpvg → Environment

**Required**:
- `OPENAI_API_KEY` - Your OpenAI API key (get from: https://platform.openai.com/api-keys)
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key (get from: https://app.supabase.com/project/_/settings/api)

**Optional**:
- `FINNHUB_API_KEY` - For stock search
- `NEWSAPI_KEY` - For news aggregation
- `NOTION_API_KEY` - For Notion export
- `NOTION_DATABASE_ID` - For Notion export

## Quick Setup Script

Run this script to set environment variables automatically:

```bash
# Backend environment variables
# Note: You'll need to get SUPABASE_SERVICE_KEY from Supabase Dashboard
# and OPENAI_API_KEY from OpenAI

# Frontend environment variables (already set via script below)
```

## Deployment Checklist

- [ ] Fix backend start command (remove --reload)
- [ ] Fix frontend build command (npm run build)
- [ ] Fix frontend publish path (dist)
- [ ] Set backend environment variables
- [ ] Set frontend environment variables
- [ ] Trigger manual deploy to test
- [ ] Verify backend health: https://alphaboard-backend.onrender.com/docs
- [ ] Verify frontend loads: https://alphaboard.onrender.com

## Testing Deployment

### Backend Health Check
```bash
curl https://alphaboard-backend.onrender.com/docs
```

### Frontend Check
Open: https://alphaboard.onrender.com

## Troubleshooting

### Backend Issues
- Check logs: https://dashboard.render.com/web/srv-d4mvrpvpm1nc73d9jpvg → Logs
- Verify environment variables are set
- Ensure start command doesn't use --reload

### Frontend Issues
- Check build logs: https://dashboard.render.com/static/srv-d4mvjl49c44c738cij60 → Logs
- Verify build command is `npm run build`
- Verify publish path is `dist`
- Check environment variables are prefixed with `VITE_`

## Notes

- Render free tier services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Consider upgrading to paid plan for always-on services
- Environment variables are encrypted at rest on Render

