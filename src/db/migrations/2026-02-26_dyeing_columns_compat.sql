-- Compatibility migration for environments missing dyeing columns.
-- Run in Supabase SQL Editor.

alter table if exists public.dyeing
  add column if not exists input_meters numeric(12,2);

alter table if exists public.dyeing
  add column if not exists dyed_meters numeric(12,2);

alter table if exists public.dyeing
  add column if not exists sent_to_stenter boolean not null default true;

alter table if exists public.dyeing
  add column if not exists is_locked boolean not null default false;

alter table if exists public.dyeing
  add column if not exists locked_at timestamptz;

alter table if exists public.dyeing
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.dyeing
  add column if not exists created_at timestamptz not null default now();

select pg_notify('pgrst', 'reload schema');
