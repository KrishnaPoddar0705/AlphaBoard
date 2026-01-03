-- Migration: Allow service role to insert recommendations
-- The backend uses service role key, but RLS policies require auth.uid() = user_id
-- Since service role has auth.uid() = NULL, we need a SECURITY DEFINER function

-- Drop existing function if it exists (with old signature)
DROP FUNCTION IF EXISTS public.create_recommendation(
  uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, text[], numeric, numeric, numeric, numeric
);

-- Create a function that can insert recommendations with SECURITY DEFINER
-- This bypasses RLS when called and allows the backend to insert on behalf of users
CREATE FUNCTION public.create_recommendation(
  p_user_id uuid,
  p_ticker text,
  p_action text,
  p_entry_price numeric,
  p_current_price numeric DEFAULT NULL,
  p_target_price numeric DEFAULT NULL,
  p_stop_loss numeric DEFAULT NULL,
  p_benchmark_ticker text DEFAULT '^NSEI',
  p_status text DEFAULT 'OPEN',
  p_thesis text DEFAULT NULL,
  p_images text[] DEFAULT NULL,
  p_entry_benchmark_price numeric DEFAULT NULL,
  p_weight_pct numeric DEFAULT NULL,
  p_invested_amount numeric DEFAULT NULL,
  p_position_size numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_id uuid;
  rec_data jsonb;
BEGIN
  INSERT INTO public.recommendations (
    user_id,
    ticker,
    action,
    entry_price,
    current_price,
    target_price,
    stop_loss,
    benchmark_ticker,
    status,
    thesis,
    images,
    entry_benchmark_price,
    weight_pct,
    invested_amount,
    position_size,
    entry_date
  ) VALUES (
    p_user_id,
    p_ticker,
    p_action,
    p_entry_price,
    p_current_price,
    p_target_price,
    p_stop_loss,
    p_benchmark_ticker,
    p_status,
    p_thesis,
    p_images,
    p_entry_benchmark_price,
    p_weight_pct,
    p_invested_amount,
    p_position_size,
    NOW()
  )
  RETURNING id INTO rec_id;
  
  -- Return the full record as JSONB
  SELECT row_to_json(r.*)::jsonb INTO rec_data
  FROM public.recommendations r
  WHERE r.id = rec_id;
  
  RETURN rec_data;
END;
$$;

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION public.create_recommendation(
  uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, text[], numeric, numeric, numeric, numeric
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_recommendation(
  uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, text[], numeric, numeric, numeric, numeric
) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_recommendation(
  uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, text[], numeric, numeric, numeric, numeric
) TO anon;

-- Verify the function was created
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'create_recommendation';

