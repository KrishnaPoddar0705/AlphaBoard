-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Public profile info for analysts)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  role text check (role in ('analyst', 'manager')) default 'analyst',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- RECOMMENDATIONS
create table public.recommendations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  ticker text not null,
  action text check (action in ('BUY', 'SELL', 'WATCH')) not null,
  entry_price numeric, -- Nullable for WATCH
  current_price numeric, -- Updated by backend
  target_price numeric,
  stop_loss numeric,
  benchmark_ticker text default '^NSEI', -- Nifty 50
  entry_date timestamp with time zone default timezone('utc'::text, now()) not null,
  status text check (status in ('OPEN', 'CLOSED', 'WATCHLIST')) default 'OPEN',
  thesis text,
  exit_price numeric,
  exit_date timestamp with time zone,
  final_return_pct numeric, -- Calculated when closed
  final_alpha_pct numeric   -- Calculated when closed
);

alter table public.recommendations enable row level security;

create policy "Recommendations are viewable by everyone."
  on public.recommendations for select
  using ( true );

create policy "Analysts can insert their own recommendations."
  on public.recommendations for insert
  with check ( auth.uid() = user_id );

create policy "Analysts can update their own recommendations."
  on public.recommendations for update
  using ( auth.uid() = user_id );

-- PERFORMANCE (Aggregated stats)
create table public.performance (
  user_id uuid references public.profiles(id) primary key,
  total_return_pct numeric default 0,
  alpha_pct numeric default 0,
  total_ideas int default 0,
  win_rate numeric default 0,
  last_updated timestamp with time zone default timezone('utc'::text, now())
);

alter table public.performance enable row level security;

create policy "Performance is viewable by everyone."
  on public.performance for select
  using ( true );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, new.raw_user_meta_data->>'username', 'analyst');
  
  insert into public.performance (user_id)
  values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

