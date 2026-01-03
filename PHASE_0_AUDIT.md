# PHASE 0: ALPHABOARD UI V2 AUDIT & MIGRATION PLAN

**Date:** 2025-01-27  
**Status:** Audit Complete - Awaiting Approval  
**Next Step:** Implement Phase 1 after approval

---

## 1. CODEBASE STRUCTURE ANALYSIS

### 1.1 Routing System
- **Framework:** React Router v7 (`react-router-dom@7.9.6`)
- **Pattern:** BrowserRouter with nested routes
- **Layout:** Single `<Layout />` component wraps all authenticated routes
- **Key Routes:**
  - `/` → Dashboard (DashboardNew.tsx)
  - `/leaderboard` → Performance Tracker
  - `/leaderboard/public` → Public Leaderboard
  - `/analyst/:id/performance` → Analyst Performance
  - `/research` → Institutional Memory (Research Library)
  - `/organization/admin` → Admin Dashboard
  - `/profile` → Profile/Settings
  - `/settings/privacy` → Privacy Settings

### 1.2 Layout Shell Components

**Current Structure:**
```
Layout.tsx (main shell)
├── Top Navbar (desktop: horizontal nav, mobile: hamburger menu)
├── MobileNavDrawer (slide-out drawer for mobile)
├── MobileBottomNav (sticky bottom nav for mobile)
└── <Outlet /> (page content)
```

**Files:**
- `frontend/src/components/Layout.tsx` - Main layout shell
- `frontend/src/components/MobileBottomNav.tsx` - Bottom navigation
- `frontend/src/components/MobileNavDrawer.tsx` - Mobile drawer menu

**Current Navigation:**
- Desktop: Horizontal top nav with border-bottom active states
- Mobile: Hamburger menu → drawer, bottom nav for primary sections
- Mobile bottom nav switches between:
  - Dashboard: View mode tabs (Active/Watchlist/History)
  - Other pages: App navigation (Dashboard/Performance/Analyst/Profile)

### 1.3 UI Primitives & Design Tokens

**Styling System:**
- **Tailwind CSS v4** (`tailwindcss@4.1.17`)
- **CSS Variables** for theming (dark/light)
- **No shadcn/ui** - Custom components only
- **Icons:** `lucide-react@0.555.0`

**Design Tokens (from `index.css`):**
```css
/* Colors */
--bg-primary: #0f172a (dark) / #f4f6fa (light)
--bg-secondary: rgba(255,255,255,0.05) / rgba(0,0,0,0.05)
--card-bg: rgba(30,41,59,0.5) / rgba(255,255,255,0.7)
--text-primary: #f1f5f9 / #0f172a
--text-secondary: #94a3b8 / #1e293b
--border-color: rgba(255,255,255,0.1) / rgba(0,0,0,0.15)

/* Spacing: Uses Tailwind defaults (0.25rem increments) */
/* Radius: Uses Tailwind defaults (rounded-xl = 0.75rem) */
```

**Existing UI Components:**
- `components/ui/Card.tsx` - Card, CardHeader, CardTitle, CardContent
- `components/ui/Skeleton.tsx` - Loading skeleton
- `components/ui/Accordion.tsx` - Accordion component
- `components/ui/DateRangePicker.tsx` - Date picker
- `components/ui/TickerInput.tsx` - Ticker input with search
- `components/ui/SectorDropdown.tsx` - Sector filter dropdown
- `components/ui/TickerFilter.tsx` - Multi-ticker filter

**Utility Classes:**
- `.glass` - Glassmorphic effect
- `.metric-card` - Metric card styling
- `.btn-premium` - Premium button gradient
- `.gradient-text` - Gradient text effect
- `.scrollbar-thin` - Custom scrollbar

### 1.4 Chart Libraries

**Multiple chart libraries in use:**
- **Nivo** (`@nivo/*`) - Multiple chart types (bar, line, pie, calendar, heatmap, etc.)
- **Recharts** (`recharts@3.5.0`) - React charting library
- **Highcharts** (`highcharts@12.4.0`, `highcharts-react-official@3.2.3`) - Advanced charts

**Chart Components:**
```
components/charts/
├── ChartRenderer.tsx
├── ContributionChart.tsx
├── DailyReturnsCalendar.tsx (Nivo Calendar)
├── HighchartsWrapper.tsx
├── IdeasAddedChart.tsx
├── KPIMiniChart.tsx
├── MonthlyPnLChart.tsx
├── MonthlyReturnsHeatmap.tsx (Nivo Heatmap)
├── NivoCharts.tsx
├── PnLDistribution.tsx
├── PortfolioAllocationDonut.tsx (Nivo Pie)
├── PortfolioAllocationPie.tsx
├── PortfolioPerformanceChart.tsx
├── ReturnSparkline.tsx
├── RollingSharpeChart.tsx
├── StackedContributionChart.tsx
├── StockChart.tsx
├── TopPerformersChart.tsx
├── WeeklyReturnsChart.tsx
└── YearlyBarChart.tsx
```

### 1.5 Main Pages

**Dashboard (`pages/DashboardNew.tsx`):**
- Split-panel layout (Idea List left, Stock Detail right)
- View modes: Active/Watchlist/History
- Charts: Portfolio returns, allocation, P&L, ideas added
- Mobile: Drawer-based navigation, bottom nav for view switching

**Performance Tracker (`pages/Leaderboard.tsx`):**
- Organization vs Public leaderboard tabs
- Analyst cards with performance metrics
- Click to view analyst detail

**Public Leaderboard (`pages/PublicLeaderboard.tsx`):**
- Public-facing leaderboard
- Similar structure to organization leaderboard

**Analyst Performance (`pages/AnalystPerformance.tsx`):**
- Individual analyst performance dashboard
- Charts and metrics

**Research Library (`pages/ResearchLibrary.tsx`):**
- Report cards grid
- RAG search bar
- Filters: Sector, ticker, status
- Upload modal

**Admin Dashboard (`components/organization/AdminDashboard.tsx`):**
- Organization management
- User roles
- Team management
- Performance overview

**Profile (`pages/Profile.tsx`):**
- User profile settings

---

## 2. FILE MAP

### Shell/Layout
```
frontend/src/components/
├── Layout.tsx                    # Main app shell (top nav + outlet)
├── MobileBottomNav.tsx           # Bottom navigation (mobile)
└── MobileNavDrawer.tsx           # Slide-out drawer (mobile)
```

### Pages
```
frontend/src/pages/
├── DashboardNew.tsx              # Main dashboard (currently used)
├── Dashboard.tsx                # Legacy dashboard (unused?)
├── Leaderboard.tsx               # Performance tracker
├── PublicLeaderboard.tsx         # Public leaderboard
├── AnalystPerformance.tsx       # Individual analyst view
├── ResearchLibrary.tsx           # Institutional Memory
├── ReportDetail.tsx              # Research report detail
├── Profile.tsx                   # User profile
├── Login.tsx                     # Auth page
├── AuthCallback.tsx              # OAuth callback
└── NotFound.tsx                  # 404 page
```

### Components
```
frontend/src/components/
├── ideas/
│   ├── IdeaList.tsx              # Idea list component
│   ├── IdeaCardMobile.tsx        # Mobile idea card
│   └── index.ts
├── stock/
│   ├── StockDetailPanel.tsx      # Stock detail view
│   ├── StockHeader.tsx
│   ├── StockTabs.tsx
│   ├── SummarySection.tsx
│   ├── ChartsSection.tsx
│   ├── FinancialsSection.tsx
│   ├── AIInsightsSection.tsx
│   ├── InvestmentThesisCard.tsx
│   ├── PriceTargetTimeline.tsx
│   └── index.ts
├── portfolio/
│   ├── PortfolioWeightPanelV2.tsx
│   ├── PerformancePreviewV2.tsx
│   └── WeightRing.tsx
├── charts/                        # 20+ chart components
├── organization/
│   ├── AdminDashboard.tsx
│   ├── CreateOrganization.tsx
│   ├── JoinOrganization.tsx
│   ├── OrganizationSettings.tsx
│   ├── TeamManagement.tsx
│   └── TeamSelector.tsx
├── research/
│   ├── ReportCard.tsx
│   ├── UploadReportModal.tsx
│   ├── RAGSearchBar.tsx
│   ├── MarkdownAnswer.tsx
│   └── GraphRenderer.tsx
├── settings/
│   ├── PrivacySettings.tsx
│   └── WhatsAppConnect.tsx
└── ui/                            # UI primitives
    ├── Card.tsx
    ├── Skeleton.tsx
    ├── Accordion.tsx
    ├── DateRangePicker.tsx
    ├── TickerInput.tsx
    ├── SectorDropdown.tsx
    └── TickerFilter.tsx
```

### Styling/Tokens
```
frontend/src/
├── index.css                     # Global styles, tokens, animations
├── App.css                       # App-specific styles
└── contexts/
    └── ThemeContext.tsx          # Theme provider
```

### Hooks
```
frontend/src/hooks/
├── useAuth.ts                    # Auth hook
├── useLayout.ts                  # Layout utilities (panel width, transitions)
├── useOrganization.ts            # Organization data
├── useTeams.ts                   # Team data
├── useTeamRecommendations.ts     # Team recommendations
├── useThesis.ts                  # Thesis data
├── useExport.ts                  # Export functionality
```

### Lib/Utils
```
frontend/src/lib/
├── api.ts                        # API functions
├── supabase.ts                   # Supabase client
├── edgeFunctions.ts              # Edge function wrappers
├── clerkSupabaseSync.ts          # Clerk-Supabase sync
├── priceCache.ts                 # Price caching
├── returnsCache.ts               # Returns caching
├── portfolioReturns.ts           # Portfolio calculations
├── chartDataHelper.ts            # Chart data utilities
├── errorSanitizer.ts             # Error handling
└── logger.ts                     # Logging utilities
```

---

## 3. MIGRATION PLAN (5-7 Steps)

### Step 1: Design System + AppShellV2 Foundation
**Goal:** Create design tokens, AppShellV2 component, and feature flag infrastructure

**Files to Create:**
- `frontend/src/design-tokens.ts` - Spacing, radius, typography scales
- `frontend/src/components/layout/AppShellV2.tsx` - New shell component
- `frontend/src/components/layout/SidebarV2.tsx` - Desktop sidebar
- `frontend/src/components/layout/TopBarV2.tsx` - Top bar
- `frontend/src/components/layout/BottomNavV2.tsx` - Mobile bottom nav
- `frontend/src/hooks/useFeatureFlag.ts` - Feature flag hook
- `frontend/src/config/featureFlags.ts` - Feature flag config

**Files to Modify:**
- `frontend/src/components/Layout.tsx` - Add feature flag check, conditionally render V2
- `frontend/src/App.tsx` - No changes (routing stays same)

**Design Tokens to Add:**
```typescript
// Spacing scale (8px base)
spacing: { xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem' }

// Radius scale
radius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem' }

// Typography scale
text: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem' }
```

**Risk:** Low - Feature flag ensures V1 remains default

---

### Step 2: Shared Component Library V2
**Goal:** Create reusable components (Card, StatCard, SectionHeader, DataTable, MobileCardList, Drawer)

**Files to Create:**
- `frontend/src/components/ui-v2/Card.tsx` - Enhanced card component
- `frontend/src/components/ui-v2/StatCard.tsx` - Stat/metric card
- `frontend/src/components/ui-v2/SectionHeader.tsx` - Section headers
- `frontend/src/components/ui-v2/SegmentedControl.tsx` - Tabs/segmented control
- `frontend/src/components/ui-v2/DataTable.tsx` - Desktop table
- `frontend/src/components/ui-v2/MobileCardList.tsx` - Mobile card list
- `frontend/src/components/ui-v2/Drawer.tsx` - Bottom sheet/drawer
- `frontend/src/components/ui-v2/index.ts` - Barrel export

**Files to Modify:**
- None (new components, no breaking changes)

**Risk:** Low - New components don't affect existing code

---

### Step 3: Dashboard V2
**Goal:** Redesign dashboard layout with new grid system and components

**Files to Create:**
- `frontend/src/pages/DashboardV2.tsx` - New dashboard page
- `frontend/src/components/dashboard-v2/OverviewStats.tsx` - Stat cards row
- `frontend/src/components/dashboard-v2/PortfolioCharts.tsx` - Charts section
- `frontend/src/components/dashboard-v2/MarketStrip.tsx` - Market tiles
- `frontend/src/components/dashboard-v2/IdeasPreview.tsx` - Ideas preview
- `frontend/src/components/dashboard-v2/EmptyStates.tsx` - Empty state components

**Files to Modify:**
- `frontend/src/App.tsx` - Add route for `/dashboard-v2` (behind feature flag)
- `frontend/src/components/Layout.tsx` - Conditionally route to V2

**Layout Structure:**
```
Row 1: Overview StatCards (4 cards: Total Return, Win Rate, Active Ideas, Alerts)
Row 2: Portfolio Returns Chart (left) + Returns Heatmap (right)
Row 3: Market Strip Tiles (horizontal scroll) + Ideas Added Chart
Row 4: My Ideas Preview List (left) + Portfolio Allocation (right)
```

**Mobile:** Stack vertically, full-width cards, thumb-friendly spacing

**Risk:** Medium - Need to ensure all data fetching/logic preserved

---

### Step 4: Ideas Page V2
**Goal:** Move "My Ideas" into dedicated page with table/card views

**Files to Create:**
- `frontend/src/pages/IdeasV2.tsx` - Ideas page
- `frontend/src/components/ideas-v2/IdeasTable.tsx` - Desktop table view
- `frontend/src/components/ideas-v2/IdeasCardList.tsx` - Mobile card list
- `frontend/src/components/ideas-v2/IdeasFilters.tsx` - Filter drawer/panel
- `frontend/src/components/ideas-v2/IdeasActions.tsx` - Action buttons

**Files to Modify:**
- `frontend/src/App.tsx` - Add `/ideas` route
- `frontend/src/components/layout/AppShellV2.tsx` - Add Ideas nav item
- `frontend/src/pages/DashboardV2.tsx` - Link to Ideas page instead of inline list

**Features:**
- Tabs: Recommendations | Watchlist | History
- Desktop: Sortable table with filters
- Mobile: Card list with swipe actions
- Keep all existing actions (Podcast, New, Save, Add to Watchlist)

**Risk:** Medium - Need to preserve all idea management functionality

---

### Step 5: Leaderboard V2
**Goal:** Integrate leaderboard into AppShellV2 with consistent styling

**Files to Create:**
- `frontend/src/pages/LeaderboardV2.tsx` - Redesigned leaderboard
- `frontend/src/components/leaderboard-v2/LeaderboardHeader.tsx` - Hero header
- `frontend/src/components/leaderboard-v2/LeaderboardTable.tsx` - Desktop table
- `frontend/src/components/leaderboard-v2/LeaderboardCards.tsx` - Mobile cards
- `frontend/src/components/leaderboard-v2/LeaderboardFilters.tsx` - Search + time range

**Files to Modify:**
- `frontend/src/App.tsx` - Route `/leaderboard` to V2 when flag enabled
- `frontend/src/pages/Leaderboard.tsx` - Keep as fallback

**Risk:** Low - Leaderboard is mostly read-only, low complexity

---

### Step 6: Research Library V2
**Goal:** Redesign Institutional Memory with two-pane desktop, mobile drawers

**Files to Create:**
- `frontend/src/pages/ResearchLibraryV2.tsx` - Redesigned research page
- `frontend/src/components/research-v2/ReportList.tsx` - Left pane (desktop)
- `frontend/src/components/research-v2/ReportDetail.tsx` - Right pane (desktop)
- `frontend/src/components/research-v2/ReportDrawer.tsx` - Mobile drawer
- `frontend/src/components/research-v2/ResearchFilters.tsx` - Filter panel

**Files to Modify:**
- `frontend/src/App.tsx` - Route `/research` to V2 when flag enabled

**Risk:** Low - Research library is mostly display, low interaction

---

### Step 7: Admin Dashboard V2
**Goal:** Apply consistent card system and table styling to admin

**Files to Create:**
- `frontend/src/components/organization-v2/AdminDashboardV2.tsx` - Redesigned admin
- `frontend/src/components/organization-v2/AdminTable.tsx` - User/team tables
- `frontend/src/components/organization-v2/DangerZone.tsx` - Danger actions section

**Files to Modify:**
- `frontend/src/App.tsx` - Route `/organization/admin` to V2 when flag enabled

**Risk:** Low - Admin is low-traffic, easier to test

---

## 4. RISKS & UNKNOWNS

### High Risk Areas
1. **Data Fetching Logic:** Dashboard has complex price polling, caching, and alert logic. Must preserve all hooks and state management.
2. **Chart Integration:** Multiple chart libraries (Nivo, Recharts, Highcharts) - need to ensure all charts render correctly in new layout.
3. **Mobile Navigation:** Current mobile nav switches between view modes (Dashboard) and app nav (other pages). V2 needs to handle this gracefully.

### Medium Risk Areas
1. **Panel Transitions:** Dashboard uses `usePanelTransition` hook for smooth panel animations. V2 needs equivalent UX.
2. **Real-time Updates:** Price polling, alert checking, portfolio calculations - ensure no performance regressions.
3. **Feature Flag Rollout:** Need clear strategy for enabling V2 page-by-page vs all-at-once.

### Low Risk Areas
1. **Styling Conflicts:** Tailwind v4 should handle this well, but need to test CSS variable overrides.
2. **Route Conflicts:** Using `/dashboard-v2` initially, then migrating `/dashboard` - should be safe.

### Unknowns
1. **User Preferences:** Do users prefer sidebar navigation or top nav? (Can A/B test)
2. **Performance:** Will new layout cause any performance issues with many charts?
3. **Accessibility:** Need to audit keyboard navigation, screen readers with new layout.

---

## 5. DECISIONS & REQUIREMENTS ✅

### Confirmed Decisions:

1. **Feature Flag Strategy:** ✅
   - **Single `UI_V2` flag** for all pages
   - Enable via environment variable or localStorage (TBD)

2. **Design Preferences:**
   - **Sidebar:** ✅ **Relative/resizable width** (not fixed), user-adjustable
   - Top bar height: 64px standard
   - Card padding: 16px (md), 20px (lg) for emphasis

3. **Mobile Navigation:** ✅
   - **Prefer different approach** (not current bottom nav)
   - Proposed: Bottom nav for primary sections + floating menu for secondary
   - Alternative: Hamburger menu with slide-out drawer

4. **Chart Library:** ✅
   - **Standardize on one library** - **Recharts** (recommended)
   - Lightweight, React-native, fast, highly customizable
   - Already in codebase, easy migration path

5. **Migration Timeline:** ✅
   - **Page-by-page migration**
   - Keep V1 as fallback until V2 is stable

6. **Testing:**
   - Test with real user data
   - Prioritize mobile devices (iOS Safari, Chrome Android)

---

## 6. NEXT STEPS

1. ✅ **Review this audit** - Complete
2. ✅ **Answer questions above** - Complete
3. ✅ **Approve migration plan** - Approved with modifications
4. **Begin Phase 1** - Starting implementation now

### Chart Library Decision: Recharts
- **Why Recharts:** Already in codebase, lightweight (~200KB), pure React components, excellent customization, good performance, active maintenance
- **Migration Path:** Gradually replace Nivo/Highcharts charts with Recharts equivalents
- **Timeline:** Migrate charts as we redesign each page

### Mobile Navigation Approach:
- **Primary Navigation:** Bottom nav bar with 4-5 main sections (Dashboard, Ideas, Performance, Profile)
- **Secondary Navigation:** Floating action button (FAB) or hamburger menu for Research, Admin, Settings
- **Alternative:** Slide-out drawer from left with all navigation items

---

## APPENDIX: QUICK REFERENCE

### Current Tech Stack
- React 19.2.0
- TypeScript 5.9.3
- React Router 7.9.6
- Tailwind CSS 4.1.17
- Clerk Auth 5.0.0
- Supabase 2.86.2
- Vite 7.2.4

### Key Dependencies
- `lucide-react` - Icons
- `react-hot-toast` - Notifications
- `framer-motion` - Animations
- `@tanstack/react-query` - Data fetching
- `clsx`, `tailwind-merge` - Class utilities

### File Count Summary
- Pages: ~12
- Components: ~50+
- Charts: ~20
- Hooks: ~7
- Utils/Lib: ~10

---

**END OF AUDIT**

