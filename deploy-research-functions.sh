#!/bin/bash

# Deploy Research Reports Edge Functions to Supabase
# Run this script to deploy all research-related Edge Functions

echo "🚀 Deploying Research Reports Edge Functions..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
echo "Checking Supabase login status..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   supabase login"
    exit 1
fi

echo "✓ Supabase CLI ready"
echo ""

# Set required environment variables
echo "📝 Setting environment variables..."
echo ""
echo "Please set these secrets in your Supabase project:"
echo "  - GEMINI_API_KEY"
echo "  - GOOGLE_CLOUD_PROJECT_ID (optional)"
echo "  - GOOGLE_APPLICATION_CREDENTIALS_JSON (optional)"
echo ""
echo "To set secrets, run:"
echo "  supabase secrets set GEMINI_API_KEY=your-key-here"
echo ""

read -p "Have you set the required secrets? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please set the secrets first, then run this script again."
    exit 1
fi

# Deploy functions
echo ""
echo "🔄 Deploying upload-research-report..."
supabase functions deploy upload-research-report --no-verify-jwt

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy upload-research-report"
    exit 1
fi

echo "✓ upload-research-report deployed"
echo ""

echo "🔄 Deploying parse-research-report..."
supabase functions deploy parse-research-report --no-verify-jwt

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy parse-research-report"
    exit 1
fi

echo "✓ parse-research-report deployed"
echo ""

echo "🔄 Deploying query-research-rag..."
supabase functions deploy query-research-rag --no-verify-jwt

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy query-research-rag"
    exit 1
fi

echo "✓ query-research-rag deployed"
echo ""

echo "✅ All functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Run the database migration:"
echo "   psql \$DATABASE_URL -f database/migration_add_research_reports.sql"
echo ""
echo "2. Create the storage bucket in Supabase Dashboard:"
echo "   - Go to Storage > Create bucket > Name: 'research-reports'"
echo "   - Apply RLS policies from database/STORAGE_BUCKET_SETUP.md"
echo ""
echo "3. Test the upload:"
echo "   npm run dev (in frontend folder)"
echo "   Navigate to 'Institutional Memory' and upload a PDF"
echo ""

