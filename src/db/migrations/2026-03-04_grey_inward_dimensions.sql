-- Add dimension and quantity fields to grey inward stage.
-- Run in Supabase SQL Editor.

alter table if exists public.grey_inward
  add column if not exists length numeric(12,2);

alter table if exists public.grey_inward
  add column if not exists width numeric(12,2);

alter table if exists public.grey_inward
  add column if not exists quantity text;
