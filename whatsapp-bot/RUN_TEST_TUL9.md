# Test Track Analyst TUL9 in Defence Team

## To Run the Test:

1. **Ensure your `.env` file has Supabase credentials:**
   ```bash
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Run the test script:**
   ```bash
   cd whatsapp-bot
   python test_tul9_simple.py
   ```

## Expected Output Format:

The script will:
1. Find analyst TUL9 by username
2. Find the Defence team in their organization
3. Verify TUL9 is a member of the Defence team
4. Fetch all recommendations (OPEN, CLOSED, WATCHLIST)
5. Fetch performance stats
6. Display formatted results similar to WhatsApp bot output

## Sample Output:

```
============================================================
Testing Track Analyst: TUL9 in Defence Team
============================================================

1. Searching for analyst TUL9...
✅ Found analyst: TUL9 Name
   Username: TUL9
   ID: <uuid>
   Organization ID: <uuid>

2. Searching for Defence team...
✅ Found team: Defence (ID: <uuid>)
✅ Analyst TUL9 Name is a member of Defence

3. Fetching recommendations...
✅ Found 15 total recommendations

4. Fetching performance stats...

============================================================
📊 ANALYST REPORT: TUL9 Name
============================================================

📊 15 ideas | Win: 65% | 🟢 +12.5% | Alpha: +8.3%

📈 Open Positions: 8
📉 Closed Positions: 7
👀 Watchlist: 0

────────────────────────────────────────────────────────────

📈 OPEN POSITIONS:
────────────────────────────────────────────────────────────
*Entry* → *CMP* | *Return* | *Target*

1. 🟢 *BUY RELIANCE*
   📅 2024-01-15
   ₹2,450 → ₹2,680 | 🟢 +9.4% | Target: ₹2,800

2. 🟢 *BUY TCS*
   📅 2024-01-20
   ₹3,200 → ₹3,150 | 🔴 -1.6% | Target: ₹3,500

...

📉 CLOSED POSITIONS (Recent):
────────────────────────────────────────────────────────────

1. 🟢 BUY INFY (2024-01-10 → 2024-02-15)
   ₹1,500 → ₹1,650 | 🟢 +10.0%

...

============================================================
✅ Test completed!
============================================================
```

## Troubleshooting:

- If analyst TUL9 is not found, the script will show available analysts
- If Defence team is not found, the script will show available teams
- If no recommendations are found, it will show 0 positions

