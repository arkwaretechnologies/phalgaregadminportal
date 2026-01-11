-- Create user_conferences junction table for reviewer-conference assignments
-- Reviewers can only see registrations for their assigned conferences
-- Admins see all conferences (no entries needed in this table)
create table if not exists public.user_conferences (
  user_id integer not null references public.users(user_id) on delete cascade,
  confcode varchar(20) not null references public.conference(confcode) on delete cascade,
  created_at timestamp without time zone default now(),
  primary key (user_id, confcode)
);

-- Create indexes for efficient lookups
create index if not exists idx_user_conferences_user_id on public.user_conferences using btree (user_id);
create index if not exists idx_user_conferences_confcode on public.user_conferences using btree (confcode);

-- Enable Row Level Security
alter table public.user_conferences enable row level security;

-- Allow all SELECT operations (authorization checked in API)
create policy "Allow select on user_conferences"
  on public.user_conferences
  for select
  using (true);

-- Allow all INSERT operations (authorization checked in API)
create policy "Allow insert on user_conferences"
  on public.user_conferences
  for insert
  with check (true);

-- Allow all UPDATE operations (authorization checked in API)
create policy "Allow update on user_conferences"
  on public.user_conferences
  for update
  using (true)
  with check (true);

-- Allow all DELETE operations (authorization checked in API)
create policy "Allow delete on user_conferences"
  on public.user_conferences
  for delete
  using (true);
