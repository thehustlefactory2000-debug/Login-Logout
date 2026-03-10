-- Textile lot workflow schema (production-grade baseline)
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stage_enum') then
    create type public.stage_enum as enum (
      'grey_inward',
      'checking',
      'bleaching',
      'dyeing',
      'stenter',
      'finishing',
      'folding',
      'completed'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'party_type_enum') then
    create type public.party_type_enum as enum ('party', 'grey_party');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lot_status_enum') then
    create type public.lot_status_enum as enum ('active', 'completed', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'checking_method_enum') then
    create type public.checking_method_enum as enum (
      'cotton_fabric',
      'cotton',
      'stamp',
      'poly_stamp',
      'roto_stamp',
      'roto_tube',
      'others'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bleach_type_enum') then
    create type public.bleach_type_enum as enum (
      'hand_poly',
      'hand_cotton',
      'power_poly',
      'power_cotton',
      'power_cotton_squeezing',
      'others'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finishing_type_enum') then
    create type public.finishing_type_enum as enum (
      'cold_felt',
      'double_felt',
      'single_felt',
      'cold_finish'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'folding_type_enum') then
    create type public.folding_type_enum as enum (
      'single_fold',
      'double_fold',
      'double_fold_checking',
      'single_fold_cutting'
    );
  end if;
end $$;

-- Support master
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.party_type_enum not null,
  created_at timestamptz not null default now(),
  unique (name, type)
);

create table if not exists public.cloth_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Lots master
create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  lot_no bigint generated always as identity unique,
  party_id uuid references public.parties(id),
  grey_party_id uuid references public.parties(id),
  cloth_type text,
  current_stage public.stage_enum not null default 'grey_inward',
  status public.lot_status_enum not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table if exists public.lots
  add column if not exists party_id uuid references public.parties(id);

alter table if exists public.lots
  add column if not exists grey_party_id uuid references public.parties(id);

alter table if exists public.lots
  add column if not exists cloth_type text;

alter table if exists public.lots
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.lots
  add column if not exists created_by uuid references auth.users(id);

create index if not exists idx_lots_lot_no on public.lots(lot_no);
create index if not exists idx_lots_current_stage on public.lots(current_stage);
create index if not exists idx_lots_created_at on public.lots(created_at desc);

-- Profiles enhancement for stage assignment
alter table if exists public.profiles
  add column if not exists assigned_stage public.stage_enum;

-- System table for audit trail
create table if not exists public.stage_logs (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  stage public.stage_enum not null,
  action text not null check (action in ('created', 'updated', 'locked')),
  done_by uuid references auth.users(id),
  "timestamp" timestamptz not null default now()
);
create index if not exists idx_stage_logs_lot_id on public.stage_logs(lot_id);
create index if not exists idx_stage_logs_timestamp on public.stage_logs("timestamp" desc);

-- Stage tables (one record per lot per stage)
create table if not exists public.grey_inward (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  meters numeric(12,2),
  jodis numeric(12,2),
  length numeric(12,2),
  width numeric(12,2),
  quantity text,
  tagge integer,
  fold_details text,
  border text,
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.grey_checking (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  checking_method public.checking_method_enum,
  input_meters numeric(12,2),
  checked_meters numeric(12,2),
  loss numeric(12,2) generated always as (coalesce(input_meters, 0) - coalesce(checked_meters, 0)) stored,
  jodis integer,
  taggas integer,
  tp text,
  fold text,
  less_short numeric(12,2),
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.bleaching (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  bleach_group_no bigint generated always as identity unique,
  bleach_type public.bleach_type_enum,
  input_meters numeric(12,2),
  output_meters numeric(12,2),
  loss numeric(12,2) generated always as (coalesce(input_meters, 0) - coalesce(output_meters, 0)) stored,
  next_stage public.stage_enum not null check (next_stage in ('dyeing', 'stenter')),
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.dyeing (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  dyeing_group_no bigint generated always as identity unique,
  input_meters numeric(12,2),
  dyed_meters numeric(12,2),
  loss numeric(12,2) generated always as (coalesce(input_meters, 0) - coalesce(dyed_meters, 0)) stored,
  sent_to_stenter boolean not null default true,
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stenter (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  stenter_no bigint generated always as identity unique,
  input_meters numeric(12,2),
  stentered_meters numeric(12,2),
  loss numeric(12,2) generated always as (coalesce(input_meters, 0) - coalesce(stentered_meters, 0)) stored,
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finishing (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  input_meters numeric(12,2),
  finished_meters numeric(12,2),
  loss numeric(12,2) generated always as (coalesce(input_meters, 0) - coalesce(finished_meters, 0)) stored,
  finishing_type public.finishing_type_enum,
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.folding (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  input_meters numeric(12,2),
  folding_type public.folding_type_enum,
  worker_name text,
  is_locked boolean not null default false,
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_grey_inward_lot_id on public.grey_inward(lot_id);
create index if not exists idx_grey_checking_lot_id on public.grey_checking(lot_id);
create index if not exists idx_bleaching_lot_id on public.bleaching(lot_id);
create index if not exists idx_dyeing_lot_id on public.dyeing(lot_id);
create index if not exists idx_stenter_lot_id on public.stenter(lot_id);
create index if not exists idx_finishing_lot_id on public.finishing(lot_id);
create index if not exists idx_folding_lot_id on public.folding(lot_id);

-- Helpers
create or replace function public.log_stage_action(
  p_lot_id uuid,
  p_stage public.stage_enum,
  p_action text,
  p_done_by uuid
)
returns void
language plpgsql
as $$
begin
  insert into public.stage_logs (lot_id, stage, action, done_by)
  values (p_lot_id, p_stage, p_action, p_done_by);
end;
$$;

create or replace function public.assert_lot_stage(
  p_lot_id uuid,
  p_expected_stage public.stage_enum
)
returns void
language plpgsql
as $$
declare
  v_stage public.stage_enum;
begin
  select current_stage into v_stage
  from public.lots
  where id = p_lot_id;

  if v_stage is null then
    raise exception 'Lot % not found', p_lot_id;
  end if;

  if v_stage <> p_expected_stage then
    raise exception 'Stage flow violation for lot %, expected %, current %', p_lot_id, p_expected_stage, v_stage;
  end if;
end;
$$;

create or replace function public.prevent_update_when_locked()
returns trigger
language plpgsql
as $$
begin
  if old.is_locked then
    raise exception 'This stage record is locked and cannot be updated';
  end if;
  return new;
end;
$$;

-- Stage transition engine
create or replace function public.transition_after_grey_inward()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_lot_stage(new.lot_id, 'grey_inward');
  update public.lots set current_stage = 'checking' where id = new.lot_id;
  perform public.log_stage_action(new.lot_id, 'grey_inward', 'created', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;

create or replace function public.transition_after_checking()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_lot_stage(new.lot_id, 'checking');
  update public.grey_inward
  set is_locked = true, locked_at = now()
  where lot_id = new.lot_id and is_locked = false;
  perform public.log_stage_action(new.lot_id, 'grey_inward', 'locked', coalesce(new.created_by, auth.uid()));
  update public.lots set current_stage = 'bleaching' where id = new.lot_id;
  perform public.log_stage_action(new.lot_id, 'checking', 'created', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;

create or replace function public.transition_after_bleaching()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_lot_stage(new.lot_id, 'bleaching');
  update public.grey_checking
  set is_locked = true, locked_at = now()
  where lot_id = new.lot_id and is_locked = false;
  perform public.log_stage_action(new.lot_id, 'checking', 'locked', coalesce(new.created_by, auth.uid()));
  update public.lots
  set current_stage = case when new.next_stage = 'dyeing' then 'dyeing' else 'stenter' end
  where id = new.lot_id;
  perform public.log_stage_action(new.lot_id, 'bleaching', 'created', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;

create or replace function public.transition_after_dyeing()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_lot_stage(new.lot_id, 'dyeing');
  update public.bleaching
  set is_locked = true, locked_at = now()
  where lot_id = new.lot_id and is_locked = false;
  perform public.log_stage_action(new.lot_id, 'bleaching', 'locked', coalesce(new.created_by, auth.uid()));
  update public.lots set current_stage = 'stenter' where id = new.lot_id;
  perform public.log_stage_action(new.lot_id, 'dyeing', 'created', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;

create or replace function public.transition_after_stenter()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_lot_stage(new.lot_id, 'stenter');
  update public.bleaching
  set is_locked = true, locked_at = now()
  where lot_id = new.lot_id and is_locked = false;
  update public.dyeing
  set is_locked = true, locked_at = now()
  where lot_id = new.lot_id and is_locked = false;
  perform public.log_stage_action(new.lot_id, 'dyeing', 'locked', coalesce(new.created_by, auth.uid()));
  update public.lots set current_stage = 'finishing' where id = new.lot_id;
  perform public.log_stage_action(new.lot_id, 'stenter', 'created', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;

create or replace function public.transition_after_finishing()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_lot_stage(new.lot_id, 'finishing');
  update public.stenter
  set is_locked = true, locked_at = now()
  where lot_id = new.lot_id and is_locked = false;
  perform public.log_stage_action(new.lot_id, 'stenter', 'locked', coalesce(new.created_by, auth.uid()));
  update public.lots set current_stage = 'folding' where id = new.lot_id;
  perform public.log_stage_action(new.lot_id, 'finishing', 'created', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;

create or replace function public.transition_after_folding()
returns trigger
language plpgsql
as $$
begin
  perform public.assert_lot_stage(new.lot_id, 'folding');
  update public.finishing
  set is_locked = true, locked_at = now()
  where lot_id = new.lot_id and is_locked = false;
  perform public.log_stage_action(new.lot_id, 'finishing', 'locked', coalesce(new.created_by, auth.uid()));
  update public.lots
  set current_stage = 'completed', status = 'completed'
  where id = new.lot_id;
  perform public.log_stage_action(new.lot_id, 'folding', 'created', coalesce(new.created_by, auth.uid()));
  return new;
end;
$$;

-- Lock protection on updates
drop trigger if exists trg_lock_guard_grey_inward on public.grey_inward;
create trigger trg_lock_guard_grey_inward
before update on public.grey_inward
for each row execute function public.prevent_update_when_locked();

drop trigger if exists trg_lock_guard_grey_checking on public.grey_checking;
create trigger trg_lock_guard_grey_checking
before update on public.grey_checking
for each row execute function public.prevent_update_when_locked();

drop trigger if exists trg_lock_guard_bleaching on public.bleaching;
create trigger trg_lock_guard_bleaching
before update on public.bleaching
for each row execute function public.prevent_update_when_locked();

drop trigger if exists trg_lock_guard_dyeing on public.dyeing;
create trigger trg_lock_guard_dyeing
before update on public.dyeing
for each row execute function public.prevent_update_when_locked();

drop trigger if exists trg_lock_guard_stenter on public.stenter;
create trigger trg_lock_guard_stenter
before update on public.stenter
for each row execute function public.prevent_update_when_locked();

drop trigger if exists trg_lock_guard_finishing on public.finishing;
create trigger trg_lock_guard_finishing
before update on public.finishing
for each row execute function public.prevent_update_when_locked();

drop trigger if exists trg_lock_guard_folding on public.folding;
create trigger trg_lock_guard_folding
before update on public.folding
for each row execute function public.prevent_update_when_locked();

-- Stage transition triggers
drop trigger if exists trg_transition_grey_inward on public.grey_inward;
create trigger trg_transition_grey_inward
after insert on public.grey_inward
for each row execute function public.transition_after_grey_inward();

drop trigger if exists trg_transition_grey_checking on public.grey_checking;
create trigger trg_transition_grey_checking
after insert on public.grey_checking
for each row execute function public.transition_after_checking();

drop trigger if exists trg_transition_bleaching on public.bleaching;
create trigger trg_transition_bleaching
after insert on public.bleaching
for each row execute function public.transition_after_bleaching();

drop trigger if exists trg_transition_dyeing on public.dyeing;
create trigger trg_transition_dyeing
after insert on public.dyeing
for each row execute function public.transition_after_dyeing();

drop trigger if exists trg_transition_stenter on public.stenter;
create trigger trg_transition_stenter
after insert on public.stenter
for each row execute function public.transition_after_stenter();

drop trigger if exists trg_transition_finishing on public.finishing;
create trigger trg_transition_finishing
after insert on public.finishing
for each row execute function public.transition_after_finishing();

drop trigger if exists trg_transition_folding on public.folding;
create trigger trg_transition_folding
after insert on public.folding
for each row execute function public.transition_after_folding();
