-- Migration: Add portfolio balance table for paper trading
-- Created: 2024

-- PORTFOLIO_BALANCE table
CREATE TABLE IF NOT EXISTS public.portfolio_balance (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  initial_balance numeric default 1000000 not null, -- ₹1,000,000 default
  current_balance numeric default 1000000, -- Calculated: available_cash + current_portfolio_value
  available_cash numeric default 1000000, -- initial_balance - total_invested
  total_invested numeric default 0, -- Sum of invested_amount for OPEN positions
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_balance_user_id ON public.portfolio_balance(user_id);

-- Enable Row Level Security
ALTER TABLE public.portfolio_balance ENABLE ROW LEVEL SECURITY;

-- Policy: Portfolio balance is viewable by everyone (for leaderboard)
CREATE POLICY "Portfolio balance is viewable by everyone."
  ON public.portfolio_balance FOR SELECT
  USING ( true );

-- Policy: Users can update their own portfolio balance
CREATE POLICY "Users can update their own portfolio balance."
  ON public.portfolio_balance FOR UPDATE
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

-- Policy: Service role can insert/update portfolio balance
CREATE POLICY "Service role can insert portfolio balance."
  ON public.portfolio_balance FOR INSERT
  WITH CHECK ( true );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portfolio_balance_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  return new;
END;
$$ language plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_portfolio_balance_timestamp
  BEFORE UPDATE ON public.portfolio_balance
  FOR EACH ROW
  EXECUTE PROCEDURE update_portfolio_balance_updated_at();

-- Initialize portfolio balance for existing users
INSERT INTO public.portfolio_balance (user_id, initial_balance, current_balance, available_cash, total_invested)
SELECT id, 1000000, 1000000, 1000000, 0
FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.portfolio_balance)
ON CONFLICT (user_id) DO NOTHING;

