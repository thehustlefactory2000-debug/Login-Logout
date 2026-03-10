-- RLS policies for lots and stage tables (admin delete).
-- Run in Supabase SQL Editor.

-- Lots
alter table if exists public.lots enable row level security;

drop policy if exists "lots_select_authenticated" on public.lots;
create policy "lots_select_authenticated"
on public.lots
for select
to authenticated
using (true);

drop policy if exists "lots_insert_authenticated" on public.lots;
create policy "lots_insert_authenticated"
on public.lots
for insert
to authenticated
with check (true);

drop policy if exists "lots_update_authenticated" on public.lots;
create policy "lots_update_authenticated"
on public.lots
for update
to authenticated
using (true)
with check (true);

drop policy if exists "lots_delete_admin_only" on public.lots;
create policy "lots_delete_admin_only"
on public.lots
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- Stage tables (read/write for authenticated, delete admin)
-- Grey inward
alter table if exists public.grey_inward enable row level security;

drop policy if exists "grey_inward_select_authenticated" on public.grey_inward;
create policy "grey_inward_select_authenticated"
on public.grey_inward
for select
to authenticated
using (true);

drop policy if exists "grey_inward_insert_authenticated" on public.grey_inward;
create policy "grey_inward_insert_authenticated"
on public.grey_inward
for insert
to authenticated
with check (true);

drop policy if exists "grey_inward_update_authenticated" on public.grey_inward;
create policy "grey_inward_update_authenticated"
on public.grey_inward
for update
to authenticated
using (true)
with check (true);

drop policy if exists "grey_inward_delete_admin_only" on public.grey_inward;
create policy "grey_inward_delete_admin_only"
on public.grey_inward
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- Grey checking
alter table if exists public.grey_checking enable row level security;

drop policy if exists "grey_checking_select_authenticated" on public.grey_checking;
create policy "grey_checking_select_authenticated"
on public.grey_checking
for select
to authenticated
using (true);

drop policy if exists "grey_checking_insert_authenticated" on public.grey_checking;
create policy "grey_checking_insert_authenticated"
on public.grey_checking
for insert
to authenticated
with check (true);

drop policy if exists "grey_checking_update_authenticated" on public.grey_checking;
create policy "grey_checking_update_authenticated"
on public.grey_checking
for update
to authenticated
using (true)
with check (true);

drop policy if exists "grey_checking_delete_admin_only" on public.grey_checking;
create policy "grey_checking_delete_admin_only"
on public.grey_checking
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- Bleaching
alter table if exists public.bleaching enable row level security;

drop policy if exists "bleaching_select_authenticated" on public.bleaching;
create policy "bleaching_select_authenticated"
on public.bleaching
for select
to authenticated
using (true);

drop policy if exists "bleaching_insert_authenticated" on public.bleaching;
create policy "bleaching_insert_authenticated"
on public.bleaching
for insert
to authenticated
with check (true);

drop policy if exists "bleaching_update_authenticated" on public.bleaching;
create policy "bleaching_update_authenticated"
on public.bleaching
for update
to authenticated
using (true)
with check (true);

drop policy if exists "bleaching_delete_admin_only" on public.bleaching;
create policy "bleaching_delete_admin_only"
on public.bleaching
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- Dyeing
alter table if exists public.dyeing enable row level security;

drop policy if exists "dyeing_select_authenticated" on public.dyeing;
create policy "dyeing_select_authenticated"
on public.dyeing
for select
to authenticated
using (true);

drop policy if exists "dyeing_insert_authenticated" on public.dyeing;
create policy "dyeing_insert_authenticated"
on public.dyeing
for insert
to authenticated
with check (true);

drop policy if exists "dyeing_update_authenticated" on public.dyeing;
create policy "dyeing_update_authenticated"
on public.dyeing
for update
to authenticated
using (true)
with check (true);

drop policy if exists "dyeing_delete_admin_only" on public.dyeing;
create policy "dyeing_delete_admin_only"
on public.dyeing
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- Stenter
alter table if exists public.stenter enable row level security;

drop policy if exists "stenter_select_authenticated" on public.stenter;
create policy "stenter_select_authenticated"
on public.stenter
for select
to authenticated
using (true);

drop policy if exists "stenter_insert_authenticated" on public.stenter;
create policy "stenter_insert_authenticated"
on public.stenter
for insert
to authenticated
with check (true);

drop policy if exists "stenter_update_authenticated" on public.stenter;
create policy "stenter_update_authenticated"
on public.stenter
for update
to authenticated
using (true)
with check (true);

drop policy if exists "stenter_delete_admin_only" on public.stenter;
create policy "stenter_delete_admin_only"
on public.stenter
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- Finishing
alter table if exists public.finishing enable row level security;

drop policy if exists "finishing_select_authenticated" on public.finishing;
create policy "finishing_select_authenticated"
on public.finishing
for select
to authenticated
using (true);

drop policy if exists "finishing_insert_authenticated" on public.finishing;
create policy "finishing_insert_authenticated"
on public.finishing
for insert
to authenticated
with check (true);

drop policy if exists "finishing_update_authenticated" on public.finishing;
create policy "finishing_update_authenticated"
on public.finishing
for update
to authenticated
using (true)
with check (true);

drop policy if exists "finishing_delete_admin_only" on public.finishing;
create policy "finishing_delete_admin_only"
on public.finishing
for delete
to authenticated
using (public.current_user_role() = 'admin');

-- Folding
alter table if exists public.folding enable row level security;

drop policy if exists "folding_select_authenticated" on public.folding;
create policy "folding_select_authenticated"
on public.folding
for select
to authenticated
using (true);

drop policy if exists "folding_insert_authenticated" on public.folding;
create policy "folding_insert_authenticated"
on public.folding
for insert
to authenticated
with check (true);

drop policy if exists "folding_update_authenticated" on public.folding;
create policy "folding_update_authenticated"
on public.folding
for update
to authenticated
using (true)
with check (true);

drop policy if exists "folding_delete_admin_only" on public.folding;
create policy "folding_delete_admin_only"
on public.folding
for delete
to authenticated
using (public.current_user_role() = 'admin');
