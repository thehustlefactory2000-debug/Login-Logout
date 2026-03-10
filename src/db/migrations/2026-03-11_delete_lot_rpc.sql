-- Delete a lot (and cascade stage rows) via SECURITY DEFINER.
-- Run in Supabase SQL Editor.

create or replace function public.delete_lot(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admin can delete lots';
  end if;

  delete from public.lots where id = p_lot_id;

  if exists (select 1 from public.lots) then
    perform setval(
      pg_get_serial_sequence('public.lots', 'lot_no'),
      (select max(lot_no) from public.lots),
      true
    );
  else
    perform setval(
      pg_get_serial_sequence('public.lots', 'lot_no'),
      1,
      false
    );
  end if;
end;
$$;

revoke all on function public.delete_lot(uuid) from public;
grant execute on function public.delete_lot(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
