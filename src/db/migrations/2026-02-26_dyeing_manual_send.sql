-- Dyeing should be editable until explicitly sent to stenter.
-- Run after base workflow migration.

alter table if exists public.dyeing
  add column if not exists is_locked boolean not null default false;

alter table if exists public.dyeing
  add column if not exists locked_at timestamptz;

alter table if exists public.dyeing
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.dyeing
  add column if not exists created_at timestamptz not null default now();

-- Add UNIQUE(lot_id) only if data has no duplicates.
do $$
declare
  v_dupes int;
begin
  select count(*) into v_dupes
  from (
    select lot_id
    from public.dyeing
    where lot_id is not null
    group by lot_id
    having count(*) > 1
  ) d;

  if v_dupes = 0 then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'dyeing_lot_id_key'
        and conrelid = 'public.dyeing'::regclass
    ) then
      alter table public.dyeing
        add constraint dyeing_lot_id_key unique (lot_id);
    end if;
  else
    raise notice 'dyeing has duplicate lot_id rows (% duplicates). UNIQUE(lot_id) not added.', v_dupes;
  end if;
end $$;

drop trigger if exists trg_transition_dyeing on public.dyeing;

create or replace function public.send_dyeing_to_stenter(
  p_lot_id uuid,
  p_done_by uuid default null
)
returns void
language plpgsql
as $$
declare
  v_is_locked boolean;
begin
  perform public.assert_lot_stage(p_lot_id, 'dyeing');

  select bool_or(is_locked) into v_is_locked
  from public.dyeing
  where lot_id = p_lot_id;

  if v_is_locked is null then
    raise exception 'Dyeing record not found for lot %', p_lot_id;
  end if;

  if v_is_locked then
    raise exception 'Dyeing already sent/locked for lot %', p_lot_id;
  end if;

  update public.dyeing
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id;

  update public.bleaching
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id and is_locked = false;

  update public.lots
  set current_stage = 'stenter'
  where id = p_lot_id;

  perform public.log_stage_action(
    p_lot_id,
    'dyeing',
    'locked',
    coalesce(p_done_by, auth.uid())
  );
end;
$$;
