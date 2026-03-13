-- Add optional masrise stage to the workflow.
-- Run in Supabase SQL Editor.

do $$
begin
  if exists (select 1 from pg_type where typname = 'stage_enum')
     and not exists (
       select 1
       from pg_enum
       where enumtypid = 'public.stage_enum'::regtype
         and enumlabel = 'masrise'
     ) then
    alter type public.stage_enum add value 'masrise' after 'bleaching';
  end if;
end $$;

create table if not exists public.masrise (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  input_meters numeric(12,2),
  completed_meters numeric(12,2),
  loss numeric(12,2) generated always as (coalesce(input_meters, 0) - coalesce(completed_meters, 0)) stored,
  instruction text,
  completed_details text,
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_masrise_lot_id on public.masrise(lot_id);

drop trigger if exists trg_lock_guard_masrise on public.masrise;
create trigger trg_lock_guard_masrise
before update on public.masrise
for each row execute function public.prevent_update_when_locked();

alter table if exists public.masrise enable row level security;

drop policy if exists "masrise_select_authenticated" on public.masrise;
create policy "masrise_select_authenticated"
on public.masrise
for select
to authenticated
using (true);

drop policy if exists "masrise_insert_authenticated" on public.masrise;
create policy "masrise_insert_authenticated"
on public.masrise
for insert
to authenticated
with check (true);

drop policy if exists "masrise_update_authenticated" on public.masrise;
create policy "masrise_update_authenticated"
on public.masrise
for update
to authenticated
using (true)
with check (true);

drop policy if exists "masrise_delete_admin_only" on public.masrise;
create policy "masrise_delete_admin_only"
on public.masrise
for delete
to authenticated
using (public.current_user_role() = 'admin');

select pg_notify('pgrst', 'reload schema');
