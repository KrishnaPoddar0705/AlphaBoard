# Community UI Setup Complete

## Overview
A complete Reddit-like community UI has been implemented for AlphaBoard with sidebar navigation, stock cards, voting, commenting, and detailed stock pages.

## What's Been Created

### 1. Database Migration
- **File**: `database/migration_add_stock_community.sql`
- **Tables Created**:
  - `stock_comments` - Comments on stocks
  - `stock_votes` - Upvotes/downvotes on stocks
  - `comment_votes` - Votes on individual comments
  - `user_stock_watchlist` - User watchlists
  - `user_stock_history` - Stock viewing history
- **Features**: RLS policies, vote count triggers, indexes

### 2. New Components

#### Layout Components
- **`components/LayoutV2.tsx`** - New sidebar-based layout matching reference design
- **`components/AppSidebar.tsx`** - Sidebar navigation with sections:
  - Discover: Community, Recommendations, Watchlist, History, My Performance
  - Organization: Institutional Memory, Tracker, Admin Dashboard
  - Settings: Profile Settings, App Settings

#### UI Components
- **`components/ui/card-shadcn.tsx`** - Shadcn-compatible Card component
- **`components/ui/textarea.tsx`** - Textarea component for comments

### 3. New Pages

#### Community Pages
- **`pages/Community.tsx`** - Main community page with stock cards (Reddit-like)
  - Displays popular stocks in a grid
  - Shows price, change, upvotes, downvotes, comments
  - Click to navigate to stock detail
  - Anonymous users can vote

- **`pages/StockDetail.tsx`** - Detailed stock page
  - Stock price and company info
  - Voting section (upvote/downvote)
  - Tabs: Overview, Financials, Comments
  - Chart placeholder (ready for charting library integration)
  - Comments section with nested comments support
  - Add to watchlist functionality

#### User Pages
- **`pages/Recommendations.tsx`** - User's stock recommendations
- **`pages/Watchlist.tsx`** - User's watchlist with remove functionality
- **`pages/History.tsx`** - Recently viewed stocks
- **`pages/Performance.tsx`** - User performance metrics

### 4. API Functions
- **`lib/community-api.ts`** - Community API functions:
  - `getStockComments()` - Fetch comments for a stock
  - `createStockComment()` - Post a comment
  - `voteOnStock()` - Vote on a stock
  - `voteOnComment()` - Vote on a comment
  - `addToWatchlist()` / `removeFromWatchlist()` - Watchlist management
  - `getWatchlist()` - Get user's watchlist
  - `trackStockView()` - Track stock views
  - `getStockHistory()` - Get viewing history

### 5. Routing Updates
- **`App.tsx`** - Updated routing:
  - Root (`/`) redirects to `/community`
  - `/community` - Community page (public)
  - `/stock/:ticker` - Stock detail page (public)
  - `/recommendations` - User recommendations (private)
  - `/watchlist` - User watchlist (private)
  - `/history` - Viewing history (private)
  - `/performance` - Performance metrics (private)
  - All other routes preserved

## Features

### ✅ Implemented
- Sidebar navigation matching reference design
- Stock cards with voting and engagement metrics
- Stock detail page with tabs
- Comments system (supports nested comments)
- Voting system (stocks and comments)
- Watchlist functionality
- Viewing history tracking
- Anonymous user support (can vote and comment)
- Mobile-responsive design
- Integration with existing backend APIs

### 🔄 Ready for Integration
- Chart library integration (placeholder in StockDetail)
- Financial data display (tabs ready, needs data fetching)
- Real-time price updates (can be added with polling/websockets)
- Nested comment threading (database supports it, UI shows flat list)

## Next Steps

1. **Install Dependencies** (if needed):
   ```bash
   cd frontend
   npm install @radix-ui/react-slot class-variance-authority
   ```

2. **Run Database Migration**:
   ```sql
   -- Run in Supabase SQL Editor or via psql
   \i database/migration_add_stock_community.sql
   ```

3. **Test the Application**:
   - Navigate to `/community` to see stock cards
   - Click on a stock to see detail page
   - Try voting and commenting (works for anonymous users)
   - Test watchlist and history features

4. **Optional Enhancements**:
   - Integrate charting library (Recharts/Highcharts) for price charts
   - Add real-time price updates
   - Implement nested comment threading UI
   - Add search functionality in sidebar
   - Add filtering/sorting on community page

## Design Notes

- Mobile-first responsive design
- Uses shadcn/ui components for consistency
- Matches reference image layout (sidebar + main content)
- Premium fintech-grade UI styling
- Clean, minimal design following user preferences

