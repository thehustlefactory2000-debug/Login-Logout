-- Store admin-configured rates for each processing stage.

create table if not exists public.stage_rates (
  id uuid primary key default gen_random_uuid(),
  stage public.stage_enum not null,
  parameter_value text,
  rate numeric(12,2) not null check (rate >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_stage_rates_stage_parameter_unique
on public.stage_rates (stage, coalesce(parameter_value, ''));

alter table if exists public.stage_rates enable row level security;

drop policy if exists "stage_rates_select_authenticated" on public.stage_rates;
create policy "stage_rates_select_authenticated"
on public.stage_rates
for select
to authenticated
using (true);

drop policy if exists "stage_rates_insert_admin_only" on public.stage_rates;
create policy "stage_rates_insert_admin_only"
on public.stage_rates
for insert
to authenticated
with check (public.current_user_role() = 'admin');

drop policy if exists "stage_rates_update_admin_only" on public.stage_rates;
create policy "stage_rates_update_admin_only"
on public.stage_rates
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "stage_rates_delete_admin_only" on public.stage_rates;
create policy "stage_rates_delete_admin_only"
on public.stage_rates
for delete
to authenticated
using (public.current_user_role() = 'admin');

select pg_notify('pgrst', 'reload schema');
