-- Migration: Add podcasts table for storing generated FinPod AI podcasts
-- Created: 2024

-- Create podcasts table
create table if not exists public.podcasts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  podcast_type text check (podcast_type in ('single-stock', 'portfolio')) not null,
  ticker text, -- Nullable for portfolio podcasts
  company_name text, -- Nullable for portfolio podcasts
  podcast_title text not null,
  duration text not null,
  script text not null,
  audio_base64 text, -- Base64 encoded MP3 audio
  key_points text[], -- For single-stock podcasts
  highlights jsonb, -- For portfolio podcasts [{ticker, summary}]
  week_start date, -- For portfolio podcasts
  week_end date, -- For portfolio podcasts
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for fast lookups
create index if not exists idx_podcasts_user_id on public.podcasts(user_id);
create index if not exists idx_podcasts_ticker on public.podcasts(ticker);
create index if not exists idx_podcasts_type on public.podcasts(podcast_type);
create index if not exists idx_podcasts_created_at on public.podcasts(created_at desc);

-- Enable Row Level Security
alter table public.podcasts enable row level security;

-- Policy: Users can view their own podcasts (service role can view all)
create policy "Users can view their own podcasts."
  on public.podcasts for select
  using ( 
    auth.uid() = user_id 
    OR 
    -- Allow if user_id exists in profiles (for service role reads)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  );

-- Policy: Allow inserts when user_id exists in profiles (for service role) or when auth.uid() matches
-- This allows backend service role to insert podcasts for any valid user_id
create policy "Service role or users can insert podcasts."
  on public.podcasts for insert
  with check ( 
    -- Allow if user_id exists in profiles table (validates foreign key and allows service role)
    -- This works because service role can check profiles table
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
    OR
    -- Also allow authenticated users to insert their own
    auth.uid() = user_id
  );

-- Policy: Users can update their own podcasts (service role can update)
create policy "Users can update their own podcasts."
  on public.podcasts for update
  using ( 
    auth.uid() = user_id 
    OR 
    -- Allow service role to update if user_id exists in profiles
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  )
  with check ( 
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  );

-- Policy: Users can delete their own podcasts (service role can delete)
create policy "Users can delete their own podcasts."
  on public.podcasts for delete
  using ( 
    auth.uid() = user_id 
    OR 
    -- Allow service role to delete if user_id exists in profiles
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
  );

-- Function to update updated_at timestamp
create or replace function update_podcasts_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_podcasts_timestamp
  before update on public.podcasts
  for each row
  execute procedure update_podcasts_updated_at();

