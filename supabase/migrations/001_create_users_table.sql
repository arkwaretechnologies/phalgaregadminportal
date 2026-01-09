-- Create users table for admin/reviewer authentication
create table if not exists public.users (
  user_id serial primary key,
  username varchar(50) unique not null,
  password_hash text not null,
  fullname text not null,
  role varchar(20) not null check (role in ('admin', 'reviewer')),
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

-- Create indexes
create index if not exists idx_users_username on public.users using btree (username);
create index if not exists idx_users_role on public.users using btree (role);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Note: We're using custom authentication (username/password), not Supabase Auth
-- Authorization is handled in the application layer (API routes)
-- These policies allow all operations - access control is enforced by our API

-- Allow all SELECT operations (authorization checked in API)
create policy "Allow select on users"
  on public.users
  for select
  using (true);

-- Allow all INSERT operations (authorization checked in API)
create policy "Allow insert on users"
  on public.users
  for insert
  with check (true);

-- Allow all UPDATE operations (authorization checked in API)
create policy "Allow update on users"
  on public.users
  for update
  using (true)
  with check (true);

-- Allow all DELETE operations (authorization checked in API)
create policy "Allow delete on users"
  on public.users
  for delete
  using (true);
