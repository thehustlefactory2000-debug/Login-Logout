-- Grey inward should be editable until explicitly sent to checking.
-- Run after the main lot workflow schema migration.

alter table if exists public.grey_inward
  add column if not exists is_locked boolean not null default false;

alter table if exists public.grey_inward
  add column if not exists locked_at timestamptz;

alter table if exists public.grey_inward
  add column if not exists created_by uuid references auth.users(id);

alter table if exists public.grey_inward
  add column if not exists created_at timestamptz not null default now();

-- Add UNIQUE(lot_id) only when data is clean (no duplicates).
do $$
declare
  v_dupes int;
begin
  select count(*) into v_dupes
  from (
    select lot_id
    from public.grey_inward
    where lot_id is not null
    group by lot_id
    having count(*) > 1
  ) d;

  if v_dupes = 0 then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'grey_inward_lot_id_key'
        and conrelid = 'public.grey_inward'::regclass
    ) then
      alter table public.grey_inward
        add constraint grey_inward_lot_id_key unique (lot_id);
    end if;
  else
    raise notice 'grey_inward has duplicate lot_id rows (% duplicates). UNIQUE(lot_id) not added.', v_dupes;
  end if;
end $$;

drop trigger if exists trg_transition_grey_inward on public.grey_inward;

create or replace function public.send_grey_inward_to_checking(
  p_lot_id uuid,
  p_done_by uuid default null
)
returns void
language plpgsql
as $$
declare
  v_is_locked boolean;
begin
  perform public.assert_lot_stage(p_lot_id, 'grey_inward');

  select bool_or(is_locked) into v_is_locked
  from public.grey_inward
  where lot_id = p_lot_id;

  if v_is_locked is null then
    raise exception 'Grey inward record not found for lot %', p_lot_id;
  end if;

  if v_is_locked then
    raise exception 'Grey inward already sent/locked for lot %', p_lot_id;
  end if;

  update public.grey_inward
  set is_locked = true,
      locked_at = now()
  where lot_id = p_lot_id;

  update public.lots
  set current_stage = 'checking'
  where id = p_lot_id;

  perform public.log_stage_action(
    p_lot_id,
    'grey_inward',
    'locked',
    coalesce(p_done_by, auth.uid())
  );
end;
$$;
