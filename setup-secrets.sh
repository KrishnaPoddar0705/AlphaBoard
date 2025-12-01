#!/bin/bash

# Script to set up Supabase secrets for edge functions
# This ensures all secrets are properly configured before deployment

set -e

echo "🔐 Supabase Secrets Setup"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install with: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"
echo ""

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in. Please login first:${NC}"
    echo "  supabase login"
    exit 1
fi

echo -e "${GREEN}✓ Logged in to Supabase${NC}"
echo ""

# Get project info
echo -e "${BLUE}Current project secrets:${NC}"
supabase secrets list
echo ""

# Prompt for secrets
echo -e "${YELLOW}Enter your Supabase credentials:${NC}"
echo "You can find these at: https://app.supabase.com/project/_/settings/api"
echo ""

read -p "Supabase URL (e.g., https://xxx.supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Both URL and Anon Key are required${NC}"
    exit 1
fi

# Set secrets
echo ""
echo "Setting secrets..."
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

echo ""
echo -e "${GREEN}✓ Secrets configured successfully!${NC}"
echo ""
echo "Verify secrets:"
echo "  supabase secrets list"
echo ""
echo "Next steps:"
echo "  1. Deploy edge functions: ./deploy-edge-functions.sh"
echo "  2. Test functions: supabase functions logs portfolio-returns"
echo ""

