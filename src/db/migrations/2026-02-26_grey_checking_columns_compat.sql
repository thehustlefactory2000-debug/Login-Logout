-- Compatibility migration for environments missing grey_checking columns.
-- Run in Supabase SQL Editor.

alter table if exists public.grey_checking
  add column if not exists checking_method public.checking_method_enum;

alter table if exists public.grey_checking
  add column if not exists input_meters numeric(12,2);

alter table if exists public.grey_checking
  add column if not exists checked_meters numeric(12,2);

alter table if exists public.grey_checking
  add column if not exists jodis integer;

alter table if exists public.grey_checking
  add column if not exists taggas integer;

alter table if exists public.grey_checking
  add column if not exists tp text;

alter table if exists public.grey_checking
  add column if not exists fold text;

alter table if exists public.grey_checking
  add column if not exists less_short numeric(12,2);

select pg_notify('pgrst', 'reload schema');
