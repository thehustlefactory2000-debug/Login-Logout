-- Allow very small decimal rates for stage billing.

alter table if exists public.stage_rates
  alter column if exists rate type numeric(12,6) using rate::numeric,
  alter column if exists meter_rate type numeric(12,6) using meter_rate::numeric,
  alter column if exists taggas_rate type numeric(12,6) using taggas_rate::numeric;

alter table if exists public.stage_payments
  alter column if exists meter_rate type numeric(12,6) using meter_rate::numeric,
  alter column if exists taggas_rate type numeric(12,6) using taggas_rate::numeric;

select pg_notify('pgrst', 'reload schema');

