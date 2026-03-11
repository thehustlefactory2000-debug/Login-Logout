-- Split checking less/short into separate meters and jodis values.
-- Run in Supabase SQL Editor.

alter table if exists public.grey_checking
  add column if not exists less_short_meters numeric(12,2);

alter table if exists public.grey_checking
  add column if not exists less_short_jodis numeric(12,2);

alter table if exists public.grey_checking
  add column if not exists less_short_meters_manual boolean not null default false;

alter table if exists public.grey_checking
  add column if not exists less_short_jodis_manual boolean not null default false;

update public.grey_checking
set less_short_jodis = less_short
where less_short is not null
  and is_locked = false
  and less_short_jodis is null;

select pg_notify('pgrst', 'reload schema');
