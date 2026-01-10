-- Create config table for admin-managed application settings
-- Requested schema:
-- create table public.config (paramname text null, paramvalue text null) TABLESPACE pg_default;

create table if not exists public.config (
  paramname text null,
  paramvalue text null
) tablespace pg_default;

-- Ensure paramname can be used as a stable key for updates/upserts
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'config_paramname_key'
      and conrelid = 'public.config'::regclass
  ) then
    alter table public.config
      add constraint config_paramname_key unique (paramname);
  end if;
end $$;

-- Seed known keys (values can remain NULL)
insert into public.config (paramname, paramvalue)
values
  ('PROVINCE_LGU_LIMIT', null),
  ('REGISTRATION_LIMIT', null),
  ('REGISTRATION_DEADLINE', null)
on conflict (paramname) do nothing;

