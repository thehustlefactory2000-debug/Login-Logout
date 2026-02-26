-- Bleaching should be editable until explicitly sent to next stage.
-- Run after base workflow migration.

alter table if exists public.bleaching
  add column if not exists is_locked boolean not null default false;

alter table if exists public.bleaching
  add column if not exists locked_at timestamptz;

alter table if exists public.bleaching
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.bleaching
  add column if not exists created_at timestamptz not null default now();

-- Add UNIQUE(lot_id) only if data has no duplicates.
do $$
declare
  v_dupes int;
begin
  select count(*) into v_dupes
  from (
    select lot_id
    from public.bleaching
    where lot_id is not null
    group by lot_id
    having count(*) > 1
  ) d;

  if v_dupes = 0 then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'bleaching_lot_id_key'
        and conrelid = 'public.bleaching'::regclass
    ) then
      alter table public.bleaching
        add constraint bleaching_lot_id_key unique (lot_id);
    end if;
  else
    raise notice 'bleaching has duplicate lot_id rows (% duplicates). UNIQUE(lot_id) not added.', v_dupes;
  end if;
end $$;

drop trigger if exists trg_transition_bleaching on public.bleaching;

create or replace function public.send_bleaching_to_next_stage(
  p_lot_id uuid,
  p_done_by uuid default null
)
returns void
language plpgsql
as $$
declare
  v_is_locked boolean;
  v_next_stage public.stage_enum;
begin
  perform public.assert_lot_stage(p_lot_id, 'bleaching');

  select bool_or(is_locked), max(next_stage)
  into v_is_locked, v_next_stage
  from public.bleaching
  where lot_id = p_lot_id;

  if v_next_stage is null then
    raise exception 'Bleaching record not found for lot %', p_lot_id;
  end if;

  if v_is_locked then
    raise exception 'Bleaching already sent/locked for lot %', p_lot_id;
  end if;

  update public.bleaching
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id;

  update public.grey_checking
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id and is_locked = false;

  update public.lots
  set current_stage = case when v_next_stage = 'dyeing' then 'dyeing' else 'stenter' end
  where id = p_lot_id;

  perform public.log_stage_action(
    p_lot_id,
    'bleaching',
    'locked',
    coalesce(p_done_by, auth.uid())
  );
end;
$$;
