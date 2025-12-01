-- Migration: Create analyst_portfolio_weights table
-- Purpose: Store user portfolio weights separately from recommendations
-- Date: 2025-01-01

-- Drop existing performance cache tables (no caching)
DROP TABLE IF EXISTS public.performance_summary_cache CASCADE;
DROP TABLE IF EXISTS public.monthly_returns_matrix CASCADE;
DROP TABLE IF EXISTS public.performance_metrics_cache CASCADE;

-- Create new portfolio weights table
CREATE TABLE IF NOT EXISTS public.analyst_portfolio_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    weight_pct FLOAT8 NOT NULL CHECK (weight_pct >= 0 AND weight_pct <= 100),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one weight per ticker per user
    CONSTRAINT unique_user_ticker UNIQUE (user_id, ticker)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_weights_user_id ON public.analyst_portfolio_weights(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_weights_ticker ON public.analyst_portfolio_weights(ticker);

-- Enable Row Level Security
ALTER TABLE public.analyst_portfolio_weights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own weights"
    ON public.analyst_portfolio_weights
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weights"
    ON public.analyst_portfolio_weights
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weights"
    ON public.analyst_portfolio_weights
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weights"
    ON public.analyst_portfolio_weights
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_analyst_portfolio_weights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.analyst_portfolio_weights
    FOR EACH ROW
    EXECUTE FUNCTION update_analyst_portfolio_weights_updated_at();

-- Grant permissions
GRANT ALL ON public.analyst_portfolio_weights TO authenticated;
GRANT ALL ON public.analyst_portfolio_weights TO service_role;

-- Optional: Create view for easier debugging
CREATE OR REPLACE VIEW public.portfolio_weights_summary AS
SELECT 
    user_id,
    COUNT(*) as num_positions,
    SUM(weight_pct) as total_weight,
    MAX(updated_at) as last_updated
FROM public.analyst_portfolio_weights
GROUP BY user_id;

GRANT SELECT ON public.portfolio_weights_summary TO authenticated;

