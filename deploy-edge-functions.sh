#!/bin/bash

# Edge Functions Deployment Script
# Quick deployment for AlphaBoard portfolio system

set -e

echo "🚀 AlphaBoard Edge Functions Deployment"
echo "======================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_REF="odfavebjfcwsovumrefx"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Installing Supabase CLI..."
    brew install supabase/tap/supabase
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"
supabase --version
echo ""

# Check if user is logged in
echo "Checking login status..."
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in. Opening browser for authentication...${NC}"
    supabase login
fi

echo -e "${GREEN}✓ Logged in to Supabase${NC}"
echo ""

# Link project
echo "Linking to project: $PROJECT_REF"
supabase link --project-ref $PROJECT_REF
echo -e "${GREEN}✓ Project linked${NC}"
echo ""

# Deploy functions
echo "Deploying Edge Functions..."
echo ""

functions=("save-weights" "get-weights" "rebalance" "portfolio-returns")

for func in "${functions[@]}"; do
    echo "📦 Deploying $func..."
    if supabase functions deploy $func; then
        echo -e "${GREEN}✓ $func deployed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to deploy $func${NC}"
        exit 1
    fi
    echo ""
done

echo ""
echo -e "${GREEN}🎉 All Edge Functions deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Run database migration (see DEPLOYMENT_INSTRUCTIONS.md)"
echo "2. Update frontend/.env with your Supabase URL and anon key"
echo "3. Restart frontend: cd frontend && npm run dev"
echo ""
echo "Test deployment:"
echo "  supabase functions list"
echo "  supabase functions logs portfolio-returns"
echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"

