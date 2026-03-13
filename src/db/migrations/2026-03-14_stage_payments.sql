-- Track stage-level payments for lots.

create table if not exists public.stage_payments (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  stage public.stage_enum not null,
  parameter_value text not null default '',
  paid_unit text not null check (paid_unit in ('meters', 'taggas')),
  processed_meters numeric(12,2) not null default 0,
  taggas numeric(12,2) not null default 0,
  meter_rate numeric(12,2),
  taggas_rate numeric(12,2),
  paid_amount numeric(12,2) not null check (paid_amount >= 0),
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

update public.stage_payments
set parameter_value = ''
where parameter_value is null;

alter table public.stage_payments
  alter column parameter_value set not null,
  alter column parameter_value set default '';

drop index if exists idx_stage_payments_unique;
create unique index idx_stage_payments_unique
on public.stage_payments (lot_id, stage, parameter_value);

create index if not exists idx_stage_payments_lot_id on public.stage_payments(lot_id);
create index if not exists idx_stage_payments_paid_at on public.stage_payments(paid_at desc);

alter table if exists public.stage_payments enable row level security;

drop policy if exists "stage_payments_select_authenticated" on public.stage_payments;
create policy "stage_payments_select_authenticated"
on public.stage_payments
for select
to authenticated
using (true);

drop policy if exists "stage_payments_insert_admin_only" on public.stage_payments;
create policy "stage_payments_insert_admin_only"
on public.stage_payments
for insert
to authenticated
with check (public.current_user_role() = 'admin');

drop policy if exists "stage_payments_update_admin_only" on public.stage_payments;
create policy "stage_payments_update_admin_only"
on public.stage_payments
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "stage_payments_delete_admin_only" on public.stage_payments;
create policy "stage_payments_delete_admin_only"
on public.stage_payments
for delete
to authenticated
using (public.current_user_role() = 'admin');

select pg_notify('pgrst', 'reload schema');
