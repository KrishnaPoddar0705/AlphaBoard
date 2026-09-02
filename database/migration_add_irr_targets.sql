-- Migration: Replace price targets with IRR targets + horizon buckets
--
-- Analysts publish an expected IRR (annualised %) over a range of months, not an
-- absolute price. This migration is ADDITIVE: existing price_targets rows keep
-- their target_price and still render as legacy entries. The table has no UPDATE
-- or DELETE policy by design (it is an immutable audit trail), so historical rows
-- are never rewritten.
--
-- Horizon buckets: 0-6, 6-12, 12-18, 18-24, 24-30, 30-36, 36-42, 42-48, 48-54, 54-60

-- ---------------------------------------------------------------------------
-- 1. price_targets: add IRR + timeframe, relax target_price
-- ---------------------------------------------------------------------------

alter table public.price_targets
  add column if not exists target_irr numeric,
  add column if not exists timeframe_start_months integer,
  add column if not exists timeframe_end_months integer;

-- New entries carry an IRR instead of a price, so target_price must be nullable.
alter table public.price_targets
  alter column target_price drop not null;

comment on column public.price_targets.target_irr is
  'Expected annualised IRR in percent (e.g. 18.5 = 18.5%). Null for legacy price-target rows.';
comment on column public.price_targets.timeframe_start_months is
  'Inclusive start of the horizon bucket, in months from creation.';
comment on column public.price_targets.timeframe_end_months is
  'Exclusive end of the horizon bucket, in months from creation.';
comment on column public.price_targets.target_price is
  'DEPRECATED. Retained for historical rows created before IRR targets.';

-- Every row must express a target one way or the other.
alter table public.price_targets
  drop constraint if exists price_targets_has_target;
alter table public.price_targets
  add constraint price_targets_has_target
  check (target_price is not null or target_irr is not null);

-- An IRR is meaningless without its horizon, so the two must arrive together.
alter table public.price_targets
  drop constraint if exists price_targets_irr_needs_timeframe;
alter table public.price_targets
  add constraint price_targets_irr_needs_timeframe
  check (
    target_irr is null
    or (timeframe_start_months is not null and timeframe_end_months is not null)
  );

-- Only the ten published buckets are valid.
alter table public.price_targets
  drop constraint if exists price_targets_timeframe_bucket;
alter table public.price_targets
  add constraint price_targets_timeframe_bucket
  check (
    timeframe_start_months is null
    or (
      timeframe_start_months >= 0
      and timeframe_start_months < 60
      and timeframe_start_months % 6 = 0
      and timeframe_end_months = timeframe_start_months + 6
    )
  );

-- The original unique constraint keys off target_price, which is NULL for IRR
-- rows -- and NULLs compare as distinct, so it no longer guards them. Add a
-- partial index that does.
create unique index if not exists idx_price_targets_unique_irr
  on public.price_targets (user_id, ticker, target_irr, timeframe_start_months, created_at)
  where target_irr is not null;

create index if not exists idx_price_targets_irr
  on public.price_targets (ticker, target_irr)
  where target_irr is not null;

-- ---------------------------------------------------------------------------
-- 2. recommendations: mirror the IRR snapshot alongside target_price
-- ---------------------------------------------------------------------------

alter table public.recommendations
  add column if not exists target_irr numeric,
  add column if not exists timeframe_start_months integer,
  add column if not exists timeframe_end_months integer;

comment on column public.recommendations.target_irr is
  'Expected annualised IRR in percent at the time the recommendation was opened.';
comment on column public.recommendations.target_price is
  'DEPRECATED. Retained for recommendations created before IRR targets.';

alter table public.recommendations
  drop constraint if exists recommendations_timeframe_bucket;
alter table public.recommendations
  add constraint recommendations_timeframe_bucket
  check (
    timeframe_start_months is null
    or (
      timeframe_start_months >= 0
      and timeframe_start_months < 60
      and timeframe_start_months % 6 = 0
      and timeframe_end_months = timeframe_start_months + 6
    )
  );

-- ---------------------------------------------------------------------------
-- 3. create_recommendation RPC: accept the IRR fields
--
-- The backend calls this with named params, so the old signature is dropped
-- rather than overloaded (overloads make PostgREST resolution ambiguous).
-- ---------------------------------------------------------------------------

-- Drop EVERY existing overload. PostgREST resolves RPC calls by argument name,
-- so a leftover overload from an earlier deploy would make the call ambiguous.
DO $drop_overloads$
DECLARE
  sig text;
BEGIN
  FOR sig IN
    SELECT pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_recommendation'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.create_recommendation(%s);', sig);
  END LOOP;
END
$drop_overloads$;

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
  p_position_size numeric DEFAULT NULL,
  p_target_irr numeric DEFAULT NULL,
  p_timeframe_start_months integer DEFAULT NULL,
  p_timeframe_end_months integer DEFAULT NULL
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
    target_irr,
    timeframe_start_months,
    timeframe_end_months,
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
    p_target_irr,
    p_timeframe_start_months,
    p_timeframe_end_months,
    NOW()
  )
  RETURNING id INTO rec_id;

  SELECT row_to_json(r.*)::jsonb INTO rec_data
  FROM public.recommendations r
  WHERE r.id = rec_id;

  RETURN rec_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_recommendation(
  uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, text[], numeric, numeric, numeric, numeric, numeric, integer, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_recommendation(
  uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, text[], numeric, numeric, numeric, numeric, numeric, integer, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_recommendation(
  uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, text[], numeric, numeric, numeric, numeric, numeric, integer, integer
) TO anon;
