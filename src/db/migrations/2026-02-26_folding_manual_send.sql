-- Folding should be editable until explicitly marked completed.
-- Run after base workflow migration.

alter table if exists public.folding
  add column if not exists input_meters numeric(12,2);

alter table if exists public.folding
  add column if not exists worker_name text;

alter table if exists public.folding
  add column if not exists folding_type public.folding_type_enum;

alter table if exists public.folding
  add column if not exists is_locked boolean not null default false;

alter table if exists public.folding
  add column if not exists locked_at timestamptz;

alter table if exists public.folding
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.folding
  add column if not exists created_at timestamptz not null default now();

do $$
declare
  v_dupes int;
begin
  select count(*) into v_dupes
  from (
    select lot_id
    from public.folding
    where lot_id is not null
    group by lot_id
    having count(*) > 1
  ) d;

  if v_dupes = 0 then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'folding_lot_id_key'
        and conrelid = 'public.folding'::regclass
    ) then
      alter table public.folding
        add constraint folding_lot_id_key unique (lot_id);
    end if;
  else
    raise notice 'folding has duplicate lot_id rows (% duplicates). UNIQUE(lot_id) not added.', v_dupes;
  end if;
end $$;

drop trigger if exists trg_transition_folding on public.folding;

create or replace function public.send_folding_to_completed(
  p_lot_id uuid,
  p_done_by uuid default null
)
returns void
language plpgsql
as $$
declare
  v_is_locked boolean;
begin
  perform public.assert_lot_stage(p_lot_id, 'folding');

  select bool_or(is_locked) into v_is_locked
  from public.folding
  where lot_id = p_lot_id;

  if v_is_locked is null then
    raise exception 'Folding record not found for lot %', p_lot_id;
  end if;

  if v_is_locked then
    raise exception 'Folding already sent/locked for lot %', p_lot_id;
  end if;

  update public.folding
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id;

  update public.finishing
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id and is_locked = false;

  update public.lots
  set current_stage = 'completed',
      status = 'completed'
  where id = p_lot_id;

  perform public.log_stage_action(
    p_lot_id,
    'folding',
    'locked',
    coalesce(p_done_by, auth.uid())
  );
end;
$$;
