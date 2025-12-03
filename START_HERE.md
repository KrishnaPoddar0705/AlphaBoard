# 🚀 RAG SYSTEM - START HERE

## ✅ What's Been Done

1. **Completely rebuilt Gemini integration** using modern File Search API (2024)
2. **Added comprehensive logging** to all Edge Functions  
3. **Deployed all 3 functions** with new code:
   - `upload-research-report` → Version 5 ✅
   - `parse-research-report` → Version 2 ✅
   - `query-research-rag` → Version 3 ✅
4. **Gemini API Key is configured** ✅

## ⚠️ What You Need to Do (2 Steps)

### Step 1: Run Database Setup (1 minute)

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/editor
   ```

2. **Click "New Query"**

3. **Copy entire contents** of this file:
   ```
   /Users/krishna.poddar/leaderboard/complete-research-setup.sql
   ```

4. **Paste into SQL Editor and click RUN**

You should see:
```
✓ research_reports table created
✓ report_queries table created
✓ Storage bucket created
✓ Storage policies created
✓ Setup Complete!
```

### Step 2: Test Upload (2 minutes)

1. **Open your app:** http://localhost:5174

2. **Click "Institutional Memory" tab**

3. **Click "Upload Report" button**

4. **Select a PDF** (any research report)

5. **Fill in the form:**
   - Title: Whatever you want
   - Sector: e.g. "Technology" or "Consumer"
   - Tickers: e.g. "AAPL, MSFT" or leave blank

6. **Click "Upload Report"**

7. **Watch the status change:**
   ```
   uploading → uploaded → indexing → indexed → parsing → parsed ✅
   ```
   (Takes 30-90 seconds total)

## 🎯 Expected Result

After ~1 minute, you'll see the report card with:
- ✅ Status: "parsed" (green badge)
- ✅ Click it to see extracted data
- ✅ Use RAG search to query across reports

## 🔍 If It Fails

### Check Logs in Real-Time

Open 3 terminals and run:

```bash
# Terminal 1: Upload logs
cd /Users/krishna.poddar/leaderboard
supabase functions logs upload-research-report --tail

# Terminal 2: Parse logs
supabase functions logs parse-research-report --tail

# Terminal 3: Test upload from browser
# (then watch logs in terminals 1 & 2)
```

You'll see detailed logs like:
```
[Upload] ========================================
[Upload] Starting upload...
[Upload] File: report.pdf (523441 bytes)
[Upload] Creating File Search Store...
[Upload] Uploading to Gemini...
[Upload] Waiting for indexing...
[Upload] Success!
[Upload] ========================================
```

### Common Issues

**"relation research_reports does not exist"**
→ Run Step 1 (database setup)

**"bucket research-reports does not exist"**  
→ Run Step 1 (database setup creates it)

**"GEMINI_API_KEY not configured"**
→ Already set! But if you see this, run:
```bash
supabase secrets set GEMINI_API_KEY=your-key-here
```

**Status stuck at "indexing" or "parsing"**
→ Check logs to see the actual error
→ File might be too large (>100MB) or invalid PDF

## 📚 Documentation

- **Full technical docs:** `RAG_SYSTEM_FIXED.md`
- **Quick test script:** `./QUICK_TEST_RAG.sh`
- **Database setup:** `complete-research-setup.sql`
- **This guide:** `START_HERE.md`

## 🎉 What You Get

Once working, you'll have:

1. **Automatic PDF parsing** - AI extracts:
   - Sector outlook
   - Key drivers & catalysts
   - Company ratings
   - Risks
   - Financial forecasts
   - Charts & tables

2. **RAG-powered search** - Ask questions like:
   - "What are the growth drivers for tech sector?"
   - "Which companies have Buy ratings?"
   - "What are the main risks?"
   - Get answers with page number citations!

3. **Multi-tenant** - Each organization has isolated File Search Store

4. **Cost-effective:**
   - Storage: FREE
   - Query embeddings: FREE
   - Only pay ~$0.02 per report for initial indexing

## 🏁 Quick Start Checklist

- [ ] Run `complete-research-setup.sql` in Supabase
- [ ] Upload a test PDF
- [ ] Wait ~1 minute for status to reach "parsed"
- [ ] Click report to see extracted data
- [ ] Try RAG search query
- [ ] Check logs if anything fails

---

## Need Help?

1. **Run:** `./QUICK_TEST_RAG.sh` for health check
2. **Read:** `RAG_SYSTEM_FIXED.md` for full docs
3. **Check logs** (commands above) to see exact errors
4. **Look for:** Lines starting with `[Upload]`, `[Parse]`, `[RAG Query]`

**The system has EXTENSIVE logging now - you'll see exactly what's happening!**

---

**Ready? Go to Step 1! ⬆️**

