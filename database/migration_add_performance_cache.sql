-- Migration: Add performance cache tables for computed metrics
-- Created: 2024

-- PERFORMANCE_METRICS_CACHE: stores computed daily/weekly/monthly metrics per user
CREATE TABLE IF NOT EXISTS public.performance_metrics_cache (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  daily_return numeric,
  portfolio_value numeric,
  benchmark_return numeric,
  benchmark_value numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, date)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_perf_metrics_user_date ON public.performance_metrics_cache(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_date ON public.performance_metrics_cache(date DESC);

-- PERFORMANCE_SUMMARY_CACHE: aggregated metrics (Sharpe, drawdown, win_rate, etc.)
CREATE TABLE IF NOT EXISTS public.performance_summary_cache (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  sharpe_ratio numeric,
  max_drawdown_pct numeric,
  profitable_weeks_pct numeric,
  avg_risk_score numeric,
  total_return_pct numeric,
  alpha_pct numeric,
  win_rate numeric,
  total_trades int,
  median_holding_period_days numeric,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- MONTHLY_RETURNS_MATRIX: pre-computed monthly returns table (2020-2025)
CREATE TABLE IF NOT EXISTS public.monthly_returns_matrix (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  year int not null,
  month int not null check (month >= 1 and month <= 12),
  return_pct numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, year, month)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_monthly_returns_user ON public.monthly_returns_matrix(user_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_returns_year_month ON public.monthly_returns_matrix(year, month);

-- Enable Row Level Security
ALTER TABLE public.performance_metrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_summary_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_returns_matrix ENABLE ROW LEVEL SECURITY;

-- Policies: Performance data is viewable by everyone (for leaderboard)
CREATE POLICY "Performance metrics cache is viewable by everyone."
  ON public.performance_metrics_cache FOR SELECT
  USING ( true );

CREATE POLICY "Performance summary cache is viewable by everyone."
  ON public.performance_summary_cache FOR SELECT
  USING ( true );

CREATE POLICY "Monthly returns matrix is viewable by everyone."
  ON public.monthly_returns_matrix FOR SELECT
  USING ( true );

-- Policies: Allow inserts/updates for service role (backend can write)
CREATE POLICY "Service role can insert performance metrics cache."
  ON public.performance_metrics_cache FOR INSERT
  WITH CHECK ( true );

CREATE POLICY "Service role can update performance metrics cache."
  ON public.performance_metrics_cache FOR UPDATE
  USING ( true )
  WITH CHECK ( true );

CREATE POLICY "Service role can insert performance summary cache."
  ON public.performance_summary_cache FOR INSERT
  WITH CHECK ( true );

CREATE POLICY "Service role can update performance summary cache."
  ON public.performance_summary_cache FOR UPDATE
  USING ( true )
  WITH CHECK ( true );

CREATE POLICY "Service role can insert monthly returns matrix."
  ON public.monthly_returns_matrix FOR INSERT
  WITH CHECK ( true );

CREATE POLICY "Service role can update monthly returns matrix."
  ON public.monthly_returns_matrix FOR UPDATE
  USING ( true )
  WITH CHECK ( true );

