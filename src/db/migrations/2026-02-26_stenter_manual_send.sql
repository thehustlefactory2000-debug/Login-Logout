-- Stenter should be editable until explicitly sent to folding.
-- Run after base workflow migration.

alter table if exists public.stenter
  add column if not exists input_meters numeric(12,2);

alter table if exists public.stenter
  add column if not exists stentered_meters numeric(12,2);

alter table if exists public.stenter
  add column if not exists is_locked boolean not null default false;

alter table if exists public.stenter
  add column if not exists locked_at timestamptz;

alter table if exists public.stenter
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.stenter
  add column if not exists created_at timestamptz not null default now();

-- Add UNIQUE(lot_id) only if data has no duplicates.
do $$
declare
  v_dupes int;
begin
  select count(*) into v_dupes
  from (
    select lot_id
    from public.stenter
    where lot_id is not null
    group by lot_id
    having count(*) > 1
  ) d;

  if v_dupes = 0 then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'stenter_lot_id_key'
        and conrelid = 'public.stenter'::regclass
    ) then
      alter table public.stenter
        add constraint stenter_lot_id_key unique (lot_id);
    end if;
  else
    raise notice 'stenter has duplicate lot_id rows (% duplicates). UNIQUE(lot_id) not added.', v_dupes;
  end if;
end $$;

drop trigger if exists trg_transition_stenter on public.stenter;

create or replace function public.send_stenter_to_folding(
  p_lot_id uuid,
  p_done_by uuid default null
)
returns void
language plpgsql
as $$
declare
  v_is_locked boolean;
begin
  perform public.assert_lot_stage(p_lot_id, 'stenter');

  select bool_or(is_locked) into v_is_locked
  from public.stenter
  where lot_id = p_lot_id;

  if v_is_locked is null then
    raise exception 'Stenter record not found for lot %', p_lot_id;
  end if;

  if v_is_locked then
    raise exception 'Stenter already sent/locked for lot %', p_lot_id;
  end if;

  update public.stenter
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id;

  update public.bleaching
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id and is_locked = false;

  update public.dyeing
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id and is_locked = false;

  update public.lots
  set current_stage = 'folding'
  where id = p_lot_id;

  perform public.log_stage_action(
    p_lot_id,
    'stenter',
    'locked',
    coalesce(p_done_by, auth.uid())
  );
end;
$$;
