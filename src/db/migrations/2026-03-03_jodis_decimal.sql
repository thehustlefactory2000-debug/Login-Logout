-- Allow decimal jodis values in grey inward/checking stages.
-- Run in Supabase SQL Editor.

alter table if exists public.grey_inward
  alter column jodis type numeric(12,2)
  using jodis::numeric(12,2);

alter table if exists public.grey_checking
  alter column jodis type numeric(12,2)
  using jodis::numeric(12,2);
