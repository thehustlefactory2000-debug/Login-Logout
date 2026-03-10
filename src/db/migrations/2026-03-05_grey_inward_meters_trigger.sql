-- Keep meters in sync with jodis x length for grey inward.
-- Run in Supabase SQL Editor.

create or replace function public.set_grey_inward_meters()
returns trigger
language plpgsql
as $$
begin
  if new.jodis is not null and new.length is not null then
    new.meters := round((new.jodis * new.length)::numeric, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_grey_inward_meters on public.grey_inward;

create trigger trg_set_grey_inward_meters
before insert or update on public.grey_inward
for each row
execute function public.set_grey_inward_meters();
