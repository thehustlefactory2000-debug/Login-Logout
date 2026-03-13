-- Support storing both meter and taggas rates on each stage rate row.

alter table if exists public.stage_rates
  add column if not exists meter_rate numeric(12,2),
  add column if not exists taggas_rate numeric(12,2);

update public.stage_rates
set
  meter_rate = case
    when meter_rate is null and coalesce(billing_unit, 'meters') = 'meters' then rate
    else meter_rate
  end,
  taggas_rate = case
    when taggas_rate is null and coalesce(billing_unit, 'meters') = 'taggas' then rate
    else taggas_rate
  end;

alter table public.stage_rates
  drop constraint if exists stage_rates_meter_rate_check;

alter table public.stage_rates
  add constraint stage_rates_meter_rate_check
  check (meter_rate is null or meter_rate >= 0);

alter table public.stage_rates
  drop constraint if exists stage_rates_taggas_rate_check;

alter table public.stage_rates
  add constraint stage_rates_taggas_rate_check
  check (taggas_rate is null or taggas_rate >= 0);

select pg_notify('pgrst', 'reload schema');
