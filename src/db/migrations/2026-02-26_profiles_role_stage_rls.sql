-- Run this in Supabase SQL Editor for existing projects.
-- It is idempotent and safe to run multiple times.

alter table if exists public.profiles
  add column if not exists email text;

alter table if exists public.profiles
  add column if not exists name text;

alter table if exists public.profiles
  add column if not exists user_id uuid;

alter table if exists public.profiles
  add column if not exists role text;

alter table if exists public.profiles
  add column if not exists assigned_stage text;

alter table if exists public.profiles
  add column if not exists created_at timestamptz default now();

alter table if exists public.profiles
  add column if not exists updated_at timestamptz default now();

alter table if exists public.profiles
  alter column role set default 'staff';

update public.profiles
set role = 'staff'
where role is null;

update public.profiles
set user_id = id
where user_id is null;

update public.profiles p
set email = u.email
from auth.users u
where coalesce(p.user_id, p.id) = u.id
  and (p.email is null or p.email = '');

insert into public.profiles (id, user_id, email, name, role, assigned_stage, created_at, updated_at)
select
  u.id,
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'name', split_part(coalesce(u.email, ''), '@', 1)),
  'staff',
  null,
  now(),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('admin', 'staff'));
  end if;
end $$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where coalesce(user_id, id) = auth.uid()
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, email, name, role, assigned_stage, created_at, updated_at)
  values (
    new.id,
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    'staff',
    null,
    now(),
    now()
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (auth.uid() = coalesce(user_id, id) or public.current_user_role() = 'admin');

drop policy if exists "profiles_insert_own_or_admin" on public.profiles;
create policy "profiles_insert_own_or_admin"
on public.profiles
for insert
to authenticated
with check (auth.uid() = coalesce(user_id, id) or public.current_user_role() = 'admin');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only"
on public.profiles
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
on public.profiles
for delete
to authenticated
using (public.current_user_role() = 'admin');
