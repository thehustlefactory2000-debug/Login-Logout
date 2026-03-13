-- Return the next lot number from the current maximum.
-- This prevents old low numbers like 1 from being reused if they were deleted.
-- Run in Supabase SQL Editor.

create or replace function public.get_next_lot_no()
returns bigint
language plpgsql
stable
as $$
begin
  if to_regclass('public.lots') is null then
    return 1;
  end if;

  return coalesce((select max(lot_no) + 1 from public.lots), 1)::bigint;
end;
$$;

revoke all on function public.get_next_lot_no() from public;
grant execute on function public.get_next_lot_no() to authenticated;

select pg_notify('pgrst', 'reload schema');
