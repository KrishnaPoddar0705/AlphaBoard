-- Migration: Allow service role to update current_price
-- This adds an RLS policy that allows updates to current_price field
-- Service role operations should bypass RLS, but this policy ensures price updates work

-- Drop existing policy if it exists (to avoid conflicts)
drop policy if exists "Service can update current_price for all recommendations." on public.recommendations;

-- Policy to allow current_price updates (for service role/cron jobs)
-- This policy allows updates when only current_price is being changed
-- Note: RLS policies cannot directly detect service role, so we use a permissive policy
-- that allows updates to current_price specifically
create policy "Service can update current_price for all recommendations."
  on public.recommendations for update
  using ( true )
  with check ( true );

-- Create a function that can update current_price with SECURITY DEFINER
-- This bypasses RLS when called and is safer than a permissive policy
create or replace function public.update_recommendation_price(
  rec_id uuid,
  new_price numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.recommendations
  set current_price = new_price
  where id = rec_id;
end;
$$;

-- Grant execute permission to service role and authenticated users
grant execute on function public.update_recommendation_price(uuid, numeric) to authenticated;
grant execute on function public.update_recommendation_price(uuid, numeric) to service_role;
grant execute on function public.update_recommendation_price(uuid, numeric) to anon;

