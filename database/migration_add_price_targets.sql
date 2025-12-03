-- Create price_targets table
create table if not exists public.price_targets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  target_price numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  target_date timestamp with time zone, -- optional time horizon
  constraint unique_user_ticker_price_time unique (user_id, ticker, target_price, created_at)
);

-- Create index for faster queries
create index if not exists idx_price_targets_user_ticker on public.price_targets(user_id, ticker);
create index if not exists idx_price_targets_created_at on public.price_targets(created_at desc);

-- Enable Row Level Security
alter table public.price_targets enable row level security;

-- Policy: Everyone can view price targets
create policy "Price targets are viewable by everyone."
  on public.price_targets for select
  using ( true );

-- Policy: Users can insert their own price targets (or service role can insert for valid users)
create policy "Service role or users can insert price targets."
  on public.price_targets for insert
  with check ( 
    -- Allow if user_id exists in profiles table (validates foreign key and allows service role)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
    OR
    -- Also allow authenticated users to insert their own
    auth.uid() = user_id
  );

-- No update or delete policies (immutable)

