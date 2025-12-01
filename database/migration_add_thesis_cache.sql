-- Migration: Add thesis_cache table for storing AI-generated investment theses
-- Created: 2024

-- Create thesis_cache table
create table if not exists public.thesis_cache (
  id uuid default uuid_generate_v4() primary key,
  ticker text not null,
  thesis_json jsonb not null,
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  regenerated_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index on ticker for fast lookups
create index if not exists idx_thesis_cache_ticker on public.thesis_cache(ticker);

-- Create index on generated_at for cache expiration queries
create index if not exists idx_thesis_cache_generated_at on public.thesis_cache(generated_at);

-- Enable Row Level Security
alter table public.thesis_cache enable row level security;

-- Policy: Everyone can read thesis cache
create policy "Thesis cache is viewable by everyone."
  on public.thesis_cache for select
  using ( true );

-- Policy: Users can insert their own thesis cache entries
-- Note: For MVP, we allow inserts from authenticated users
-- In production, you might want to restrict this further
create policy "Users can insert thesis cache entries."
  on public.thesis_cache for insert
  with check ( true );

-- Policy: Users can update thesis cache entries
create policy "Users can update thesis cache entries."
  on public.thesis_cache for update
  using ( true );

-- Function to update updated_at timestamp
create or replace function update_thesis_cache_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_thesis_cache_timestamp
  before update on public.thesis_cache
  for each row
  execute procedure update_thesis_cache_updated_at();

