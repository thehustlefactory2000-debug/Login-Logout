-- Fix parties uniqueness for existing projects:
-- allow same name across different party types.

alter table if exists public.parties
  drop constraint if exists parties_name_key;

alter table if exists public.parties
  add constraint parties_name_type_key unique (name, type);
