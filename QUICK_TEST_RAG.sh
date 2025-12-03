#!/bin/bash

# Quick RAG System Testing Script
# Run this to verify everything is working

echo "=========================================="
echo "RAG SYSTEM HEALTH CHECK"
echo "=========================================="
echo ""

cd /Users/krishna.poddar/leaderboard

echo "1️⃣  Checking Edge Functions..."
echo "Looking for research functions (should show v5, v2, v3):"
supabase functions list | grep research
echo ""

echo "2️⃣  Checking Gemini API Key..."
if supabase secrets list | grep -q "GEMINI_API_KEY"; then
    echo "✅ GEMINI_API_KEY is set"
else
    echo "❌ GEMINI_API_KEY is NOT set!"
    echo "   Fix: supabase secrets set GEMINI_API_KEY=your-key-here"
    echo "   Get key at: https://aistudio.google.com/apikey"
fi
echo ""

echo "3️⃣  Checking Database Tables..."
echo "Run this SQL query in Supabase Dashboard to verify:"
echo ""
echo "SELECT table_name FROM information_schema.tables"
echo "WHERE table_name IN ('research_reports', 'report_queries');"
echo ""
echo "Should show both tables. If not, run: complete-research-setup.sql"
echo ""

echo "4️⃣  Watch Live Logs (in separate terminals):"
echo ""
echo "Terminal 1: supabase functions logs upload-research-report --tail"
echo "Terminal 2: supabase functions logs parse-research-report --tail"
echo "Terminal 3: supabase functions logs query-research-rag --tail"
echo ""

echo "=========================================="
echo "TEST UPLOAD"
echo "=========================================="
echo ""
echo "1. Go to: http://localhost:5174"
echo "2. Click 'Institutional Memory' tab"
echo "3. Click 'Upload Report' button"
echo "4. Select a PDF file"
echo "5. Fill in title, sector, tickers"
echo "6. Click 'Upload Report'"
echo ""
echo "Expected timeline:"
echo "  0-5s:   uploading → uploaded"
echo "  5-30s:  uploaded → indexing → indexed"
echo "  30-90s: indexed → parsing → parsed ✅"
echo ""
echo "If it fails at 'indexing' or 'parsing':"
echo "  - Check logs (commands above)"
echo "  - Verify GEMINI_API_KEY is set"
echo "  - Check file size < 100MB"
echo ""

echo "=========================================="
echo "DEBUGGING"
echo "=========================================="
echo ""
echo "Check failed reports:"
echo "  SELECT id, title, upload_status, error_message"
echo "  FROM research_reports"
echo "  WHERE upload_status = 'failed'"
echo "  ORDER BY created_at DESC;"
echo ""
echo "Check latest reports:"
echo "  SELECT id, title, upload_status, created_at"
echo "  FROM research_reports"
echo "  ORDER BY created_at DESC"
echo "  LIMIT 5;"
echo ""
echo "Reset stuck reports:"
echo "  UPDATE research_reports"
echo "  SET upload_status = 'uploaded', error_message = NULL"
echo "  WHERE upload_status IN ('indexing', 'parsing')"
echo "  AND created_at < NOW() - INTERVAL '10 minutes';"
echo ""

echo "=========================================="
echo "READY TO TEST!"
echo "=========================================="
echo ""
echo "📖 Full docs: RAG_SYSTEM_FIXED.md"
echo "🔧 Setup SQL: complete-research-setup.sql"
echo ""

