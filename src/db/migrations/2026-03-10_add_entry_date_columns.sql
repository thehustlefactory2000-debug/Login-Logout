-- Add explicit entry date to lots and grey_inward and backfill existing rows.
alter table if exists public.lots
  add column if not exists entry_date date;

alter table if exists public.grey_inward
  add column if not exists entry_date date;

update public.lots
set entry_date = created_at::date
where entry_date is null;

update public.grey_inward
set entry_date = created_at::date
where entry_date is null;

alter table if exists public.lots
  alter column entry_date set default current_date;

alter table if exists public.grey_inward
  alter column entry_date set default current_date;

alter table if exists public.lots
  alter column entry_date set not null;

alter table if exists public.grey_inward
  alter column entry_date set not null;

create index if not exists idx_lots_entry_date on public.lots(entry_date desc);
create index if not exists idx_grey_inward_entry_date on public.grey_inward(entry_date desc);
