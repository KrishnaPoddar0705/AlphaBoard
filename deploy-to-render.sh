#!/bin/bash

# Render.com Deployment Helper Script
# This script helps you complete the deployment setup

set -e

echo "🚀 Render.com Deployment Setup"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Current Deployment Status:${NC}"
echo ""
echo "✅ Frontend environment variables set:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo ""
echo "✅ Backend environment variables set:"
echo "   - SUPABASE_URL"
echo ""
echo -e "${YELLOW}⚠️  Manual Steps Required:${NC}"
echo ""
echo "1. Add Backend Secrets (via Render Dashboard):"
echo "   https://dashboard.render.com/web/srv-d4mvrpvpm1nc73d9jpvg → Environment"
echo ""
echo "   Required:"
echo "   - OPENAI_API_KEY (get from: https://platform.openai.com/api-keys)"
echo "   - SUPABASE_SERVICE_KEY (get from: https://app.supabase.com/project/_/settings/api)"
echo ""
echo "   Optional:"
echo "   - FINNHUB_API_KEY"
echo "   - NEWSAPI_KEY"
echo "   - NOTION_API_KEY"
echo "   - NOTION_DATABASE_ID"
echo ""
echo "2. Fix Backend Start Command:"
echo "   https://dashboard.render.com/web/srv-d4mvrpvpm1nc73d9jpvg → Settings"
echo "   Change: uvicorn app.main:app --reload"
echo "   To:     uvicorn app.main:app --host 0.0.0.0 --port \$PORT"
echo ""
echo "3. Fix Frontend Build Configuration:"
echo "   https://dashboard.render.com/static/srv-d4mvjl49c44c738cij60 → Settings"
echo "   Build Command: npm run build"
echo "   Publish Path:  dist"
echo ""
echo -e "${GREEN}✅ Automatic Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Complete the manual steps above"
echo "2. Services will auto-deploy on next commit to main branch"
echo "3. Or trigger manual deploy from Render Dashboard"
echo ""
echo "Service URLs:"
echo "  Backend:  https://alphaboard-backend.onrender.com"
echo "  Frontend: https://alphaboard.onrender.com"
echo ""

