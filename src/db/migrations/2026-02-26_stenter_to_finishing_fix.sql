-- Fix flow: stenter must move to finishing (not folding).
-- Run in Supabase SQL Editor after previous stenter migration.

create or replace function public.send_stenter_to_finishing(
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
  set current_stage = 'finishing'
  where id = p_lot_id;

  perform public.log_stage_action(
    p_lot_id,
    'stenter',
    'locked',
    coalesce(p_done_by, auth.uid())
  );
end;
$$;

-- Keep backward compatibility if old frontend still calls this function.
create or replace function public.send_stenter_to_folding(
  p_lot_id uuid,
  p_done_by uuid default null
)
returns void
language sql
as $$
  select public.send_stenter_to_finishing(p_lot_id, p_done_by);
$$;
