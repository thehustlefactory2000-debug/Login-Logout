-- Store party phone number on grey inward entries.

alter table if exists public.grey_inward
  add column if not exists party_phone text;

update public.grey_inward
set party_phone = ''
where party_phone is null
  and is_locked = false;

select pg_notify('pgrst', 'reload schema');
