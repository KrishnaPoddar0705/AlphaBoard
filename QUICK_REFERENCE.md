# 📋 QUICK REFERENCE CARD

## 🎯 What to Do Next (3 minutes)

### 1. Run Database Setup
```
Open: https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/editor
Copy: /Users/krishna.poddar/leaderboard/complete-research-setup.sql
Paste & Run in SQL Editor
```

### 2. Test Upload
```
Open: http://localhost:5174
Click: "Institutional Memory"
Click: "Upload Report"
Select: Any PDF
Wait: 30-90 seconds
See: status = "parsed" ✅
```

## 📊 Status Flow
```
uploading → uploaded → indexing → indexed → parsing → parsed ✅
   (1s)      (10-30s)              (20-60s)
```

## 🔍 Watch Logs
```bash
# Terminal 1
supabase functions logs upload-research-report --tail

# Terminal 2
supabase functions logs parse-research-report --tail
```

## ✅ What's Done
- ✅ Functions deployed (v5, v2, v3)
- ✅ Modern File Search API (2024)
- ✅ Comprehensive logging added
- ✅ GEMINI_API_KEY configured
- ✅ Free storage + free queries

## ❓ If It Fails
1. Check logs (see above)
2. Verify database setup complete
3. Look for [Upload] or [Parse] error messages
4. Check `error_message` in database

## 📚 Full Docs
- **Quick start:** `START_HERE.md`
- **Technical details:** `RAG_SYSTEM_FIXED.md`
- **Implementation summary:** `IMPLEMENTATION_COMPLETE.md`
- **Health check:** `./QUICK_TEST_RAG.sh`

## 💰 Cost
- Storage: FREE
- Queries: FREE
- Indexing: ~$0.02/report
- Total: ~$2 for 100 reports

## 🚀 Ready to Test!
Run Step 1 (database setup), then upload a PDF!

