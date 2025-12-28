-- Add exit columns
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS exit_price numeric;
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS exit_date timestamp with time zone;

-- Make entry_price nullable for Watchlist items
ALTER TABLE public.recommendations ALTER COLUMN entry_price DROP NOT NULL;

-- Update constraints to support Watchlist
ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_action_check;
ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_action_check CHECK (action IN ('BUY', 'SELL', 'WATCH'));

ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_status_check;
ALTER TABLE public.recommendations ADD CONSTRAINT recommendations_status_check CHECK (status IN ('OPEN', 'CLOSED', 'WATCHLIST'));

-- Force schema cache reload for Supabase/PostgREST
NOTIFY pgrst, 'reload schema';



