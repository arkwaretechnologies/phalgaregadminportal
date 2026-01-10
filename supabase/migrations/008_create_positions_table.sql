-- Create positions table for storing all available positions
create table if not exists public.positions (
  position_id serial primary key,
  name text not null unique,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

-- Create index on name for faster lookups
create index if not exists idx_positions_name on public.positions using btree (name);

-- Enable Row Level Security
alter table public.positions enable row level security;

-- Allow all SELECT operations (authorization checked in API)
create policy "Allow select on positions"
  on public.positions
  for select
  using (true);

-- Allow all INSERT operations (authorization checked in API)
create policy "Allow insert on positions"
  on public.positions
  for insert
  with check (true);

-- Allow all UPDATE operations (authorization checked in API)
create policy "Allow update on positions"
  on public.positions
  for update
  using (true)
  with check (true);

-- Allow all DELETE operations (authorization checked in API)
create policy "Allow delete on positions"
  on public.positions
  for delete
  using (true);

-- Insert all positions
insert into public.positions (name)
values
  ('Provincial Governor'),
  ('Provincial Vice Governor'),
  ('Sangguniang Panlalawigan Member'),
  ('Provincial Administrator'),
  ('Provincial Legal Officer'),
  ('Provincial Planning and Development Coordinator'),
  ('Provincial Budget Officer'),
  ('Provincial Treasurer'),
  ('Provincial Assessor'),
  ('Provincial Accountant'),
  ('Provincial Engineer'),
  ('Provincial Health Officer'),
  ('Provincial Social Welfare and Development Officer'),
  ('Provincial Agriculturist'),
  ('Provincial Environment and Natural Resources Officer'),
  ('Provincial General Services Officer'),
  ('Provincial Information Officer'),
  ('City Mayor'),
  ('City Vice Mayor'),
  ('Sangguniang Panlungsod Member'),
  ('City Administrator'),
  ('City Legal Officer'),
  ('City Planning and Development Coordinator'),
  ('City Budget Officer'),
  ('City Treasurer'),
  ('City Assessor'),
  ('City Accountant'),
  ('City Engineer'),
  ('City Health Officer'),
  ('City Social Welfare and Development Officer'),
  ('City Agriculturist'),
  ('City Environment and Natural Resources Officer'),
  ('City General Services Officer'),
  ('City Information Officer'),
  ('Municipal Mayor'),
  ('Municipal Vice Mayor'),
  ('Sangguniang Bayan Member'),
  ('Municipal Administrator'),
  ('Municipal Legal Officer'),
  ('Municipal Planning and Development Coordinator'),
  ('Municipal Budget Officer'),
  ('Municipal Treasurer'),
  ('Municipal Assessor'),
  ('Municipal Accountant'),
  ('Municipal Engineer'),
  ('Municipal Health Officer'),
  ('Municipal Social Welfare and Development Officer'),
  ('Municipal Agriculturist'),
  ('Municipal Environment and Natural Resources Officer'),
  ('Municipal General Services Officer'),
  ('Municipal Information Officer'),
  ('Punong Barangay'),
  ('Sangguniang Barangay Member'),
  ('Barangay Secretary'),
  ('Barangay Treasurer'),
  ('Barangay Bookkeeper'),
  ('Sangguniang Kabataan Chairperson'),
  ('Sangguniang Kabataan Member')
on conflict (name) do nothing;
