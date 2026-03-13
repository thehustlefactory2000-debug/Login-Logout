-- Add checked length to checking so checked meters can be auto-calculated.
-- Run in Supabase SQL Editor.

alter table if exists public.grey_checking
  add column if not exists checked_length numeric(12,2);

select pg_notify('pgrst', 'reload schema');
