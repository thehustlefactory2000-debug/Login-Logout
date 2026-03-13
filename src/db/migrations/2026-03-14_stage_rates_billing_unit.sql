-- Add billing unit to stage rates so a stage can be billed by meters or taggas.

alter table if exists public.stage_rates
  add column if not exists billing_unit text not null default 'meters';

alter table public.stage_rates
  drop constraint if exists stage_rates_billing_unit_check;

alter table public.stage_rates
  add constraint stage_rates_billing_unit_check
  check (billing_unit in ('meters', 'taggas'));

select pg_notify('pgrst', 'reload schema');
