-- Platform personeli: uygulamadaki tüm ekipleri ve ekip detayı için gerekli ilişkili satırları okuyabilsin.
-- is_platform_staff_member() 049 migration'ında tanımlı.

-- teams
drop policy if exists "Platform staff read all teams" on public.teams;
create policy "Platform staff read all teams"
on public.teams for select to authenticated
using ( public.is_platform_staff_member() );

-- team_members
drop policy if exists "Platform staff read all team_members" on public.team_members;
create policy "Platform staff read all team_members"
on public.team_members for select to authenticated
using ( public.is_platform_staff_member() );

-- shifts
drop policy if exists "Platform staff read all shifts" on public.shifts;
create policy "Platform staff read all shifts"
on public.shifts for select to authenticated
using ( public.is_platform_staff_member() );

-- shift_logs
drop policy if exists "Platform staff read all shift_logs" on public.shift_logs;
create policy "Platform staff read all shift_logs"
on public.shift_logs for select to authenticated
using ( public.is_platform_staff_member() );

-- team_join_requests
drop policy if exists "Platform staff read all team_join_requests" on public.team_join_requests;
create policy "Platform staff read all team_join_requests"
on public.team_join_requests for select to authenticated
using ( public.is_platform_staff_member() );

-- team_member_feature_permissions
drop policy if exists "Platform staff read team_member_feature_permissions" on public.team_member_feature_permissions;
create policy "Platform staff read team_member_feature_permissions"
on public.team_member_feature_permissions for select to authenticated
using ( public.is_platform_staff_member() );

-- RBAC (ekip detayı üye rolleri)
drop policy if exists "Platform staff read organizations" on public.organizations;
create policy "Platform staff read organizations"
on public.organizations for select to authenticated
using ( public.is_platform_staff_member() );

drop policy if exists "Platform staff read members" on public.members;
create policy "Platform staff read members"
on public.members for select to authenticated
using ( public.is_platform_staff_member() );

drop policy if exists "Platform staff read roles" on public.roles;
create policy "Platform staff read roles"
on public.roles for select to authenticated
using ( public.is_platform_staff_member() );

drop policy if exists "Platform staff read role_levels" on public.role_levels;
create policy "Platform staff read role_levels"
on public.role_levels for select to authenticated
using ( public.is_platform_staff_member() );

drop policy if exists "Platform staff read role_permissions" on public.role_permissions;
create policy "Platform staff read role_permissions"
on public.role_permissions for select to authenticated
using ( public.is_platform_staff_member() );

drop policy if exists "Platform staff read member_roles" on public.member_roles;
create policy "Platform staff read member_roles"
on public.member_roles for select to authenticated
using ( public.is_platform_staff_member() );

drop policy if exists "Platform staff read stores" on public.stores;
create policy "Platform staff read stores"
on public.stores for select to authenticated
using ( public.is_platform_staff_member() );
