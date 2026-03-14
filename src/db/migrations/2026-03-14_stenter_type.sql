-- Add stenter type parameter for billing/rates and planning.

alter table if exists public.stenter
  add column if not exists stenter_type text not null default '';

update public.stenter
set stenter_type = ''
where stenter_type is null;

alter table public.stenter
  drop constraint if exists stenter_stenter_type_check;

alter table public.stenter
  add constraint stenter_stenter_type_check
  check (stenter_type in ('bleach_stenter', 'dyeing_stenter', ''));

create index if not exists idx_stenter_type on public.stenter(stenter_type);

select pg_notify('pgrst', 'reload schema');
