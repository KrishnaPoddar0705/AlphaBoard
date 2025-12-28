# Rolling Portfolio Returns - Implementation Plan

## A) Repo Discovery

### Current Implementation

**Portfolio Returns Chart Location:**
- Component: `frontend/src/components/charts/WeeklyReturnsChart.tsx`
- Chart Library: **Nivo** (`@nivo/bar`) - ResponsiveBar component
- Used in: `frontend/src/pages/DashboardNew.tsx` (lines 1248, 1514)
- Current calculation: Client-side in `DashboardNew.tsx` (lines 746-919) using `useMemo`

**Data Sources:**
- Recommendations table: `public.recommendations` in Supabase
- Key fields:
  - `ticker` (text)
  - `entry_date` (timestamp with time zone) - **This is the "added_at" date**
  - `status` ('OPEN', 'CLOSED', 'WATCHLIST')
  - `entry_price` (numeric)
  - `current_price` (numeric) - updated by backend cron
  - `exit_date` (timestamp with time zone)
  - `exit_price` (numeric)
  - `action` ('BUY', 'SELL', 'WATCH')
  - `position_size` (numeric, optional) - for weighting
  - `invested_amount` (numeric, optional) - for weighting
- Fetched via: Direct Supabase query in `DashboardNew.tsx` (line 177-181)
- No existing API endpoint for portfolio returns - calculated client-side

**Price Data:**
- Backend function: `backend/app/market.py::get_stock_history_data(ticker, period="5y")`
- Uses: **yfinance** library
- Endpoint: `GET /market/history/{ticker}` 
- Returns: Array of `{date: "YYYY-MM-DD", open, high, low, close, volume}`
- Storage: **NOT stored in DB** - fetched on-demand from Yahoo Finance
- Caching: In-memory cache in `market.py` (5 min TTL, key: `{ticker}_history_{period}`)
- Edge Function: `supabase/functions/portfolio-returns/index.ts` exists but uses different logic

**Current Issues:**
1. Calculation happens client-side (inefficient for large datasets)
2. Uses `calculateDailyReturn()` which doesn't have proper historical price data
3. Doesn't properly build daily series from `entry_date` forward
4. Weekly/Monthly aggregation averages daily returns instead of rolling compounded returns
5. No backend endpoint for rolling returns calculation

### Files to Modify

**Backend/API Layer:**
- `backend/app/main.py` - Add new endpoint `GET /api/portfolio/rolling-returns`
- `backend/app/market.py` - Enhance `get_stock_history_data()` or create new function for batch historical fetch
- `backend/app/portfolio_returns.py` (NEW) - Pure compute functions for rolling returns

**Database/Schema:**
- No schema changes needed - `entry_date` already exists
- Consider: Add index on `entry_date` if not exists (performance optimization)

**Frontend Components:**
- `frontend/src/components/charts/WeeklyReturnsChart.tsx` - Update to handle new data format
- `frontend/src/pages/DashboardNew.tsx` - Replace client-side calculation with API call
- `frontend/src/lib/api.ts` - Add `getRollingPortfolioReturns(range)` function

**Chart Component:**
- `frontend/src/components/charts/WeeklyReturnsChart.tsx` - Already uses Nivo, no library changes needed

### Compute Approach

**Algorithm:**
1. **Daily Series Construction:**
   - Determine date range: earliest `entry_date` to today
   - For each trading day:
     - Get all stocks where `entry_date <= day` AND (`exit_date >= day` OR `status = 'OPEN'`)
     - Fetch daily close prices for all active tickers (batch fetch)
     - Calculate per-ticker daily return: `(close_t / close_{t-1}) - 1`
     - Portfolio daily return: weighted average of active tickers' returns
       - If `position_size` or `invested_amount` exists: use as weights (normalized)
       - Else: equal weight

2. **Rolling Aggregation:**
   - **Weekly (7 trading days):** `R_t^(7) = product(1 + r_i) for i in [t-6, t] - 1`
   - **Monthly (30 trading days):** `R_t^(30) = product(1 + r_i) for i in [t-29, t] - 1`
   - Return as percentages

3. **Missing Data Handling:**
   - Skip non-trading days (weekends/holidays)
   - For missing ticker prices: exclude ticker from portfolio for that day, re-normalize weights
   - Log missing symbols for debugging

**Performance Considerations:**
- Batch fetch historical prices for all tickers at once (reduce API calls)
- Cache historical price data (extend cache TTL for historical data)
- Consider storing daily prices in DB for frequently accessed tickers (future optimization)
- Limit date range queries (e.g., max 1 year back)
- Use async/await for parallel price fetches

---

## Clarifying Questions

**Please answer these questions before implementation:**

### 1) Portfolio Definition
What defines "portfolio"?
- [ ] All Active recommendations (`status = 'OPEN'`)?
- [ ] Only Watchlist (`status = 'WATCHLIST'`)?
- [ ] Only stocks user marked as "in portfolio"?
- [ ] All recommendations with `entry_date` (OPEN + CLOSED)?

**Current behavior:** Filters out WATCHLIST, includes OPEN and CLOSED. Should we keep this?

### 2) Weighting
- [ ] Equal weight per active stock (current behavior)
- [ ] Use `position_size` if available
- [ ] Use `invested_amount` if available
- [ ] Use `weight_pct` if available (from migration_add_weight_pct.sql)

**If weights exist:**
- [ ] Fixed at add date (weights set when stock added)
- [ ] Editable over time (rebalance changes weights)

### 3) Rolling Week/Month Definition
- [ ] 7 and 30 **TRADING days** (recommended - aligns with market calendar)
- [ ] Calendar week/month boundaries (e.g., Nov 1-30, Dec 1-31)

**Recommendation:** Trading days (more accurate for portfolio performance)

### 4) Return Type
- [ ] Simple return series: `(close_t / close_{t-1}) - 1` (current)
- [ ] Log returns: `ln(close_t / close_{t-1})`

**Bar chart should show:**
- [ ] Period return (daily/rolling weekly/rolling monthly) - **current behavior**
- [ ] Cumulative return (total return from start)

**Recommendation:** Simple returns, period returns in bars (cumulative can be overlay line)

### 5) Pricing Data Source
- [ ] Fetch from Yahoo Finance on-demand via yfinance (current)
- [ ] Store daily close prices in DB (requires new table + migration)
- [ ] Hybrid: Cache frequently accessed tickers in DB

**Current:** On-demand fetch with 5-min cache. For rolling returns, we'll need historical data for multiple tickers. Should we:
- Fetch on-demand (slower but no DB changes)
- Create `daily_prices` table to cache historical data (faster, requires migration)

---

## Implementation Steps (After Answers)

**Commit 1: Compute Functions + Tests**
- Create `backend/app/portfolio_returns.py` with pure functions
- Add unit tests with fixture data
- Test: adding tickers mid-series, equal-weight vs weighted, missing days, rolling compounding

**Commit 2: API Endpoint**
- Add `GET /api/portfolio/rolling-returns?range=DAY|WEEK|MONTH&user_id={id}`
- Integrate compute functions
- Add caching layer
- Handle missing price data gracefully

**Commit 3: Frontend Chart + Toggle + Styling**
- Update `DashboardNew.tsx` to call API instead of client-side calc
- Ensure Day/Week/Month toggle works
- Update `WeeklyReturnsChart.tsx` if data format changes
- Test responsive design (mobile + desktop)

---

**Status:** Waiting for answers to clarifying questions before proceeding.

