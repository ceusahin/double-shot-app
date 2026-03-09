-- Ekip liderleri (ekip sahibi veya MANAGER) kendi ekiplerinde rol ve yetki yönetimi yapabilsin.
-- Organizasyon sahibi (owner_id) ile birlikte, bu organizasyona bağlı takımda owner veya MANAGER
-- olan kullanıcılar da roles, role_levels, role_permissions, member_roles üzerinde manage yetkisine sahip.

-- Helper: organizasyon için ekip lideri mi (org sahibi veya bu org'a bağlı bir takımda owner/manager)
-- (Policies içinde inline kullanacağız.)

-- Roles: manage -> org owner VEYA ekip lideri
drop policy if exists "Roles manage" on public.roles;
create policy "Roles manage" on public.roles for all using (
  exists (select 1 from public.organizations where id = roles.organization_id and owner_id = auth.uid())
  or exists (
    select 1 from public.teams t
    where t.organization_id = roles.organization_id
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.team_members tm
                      where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))
  )
);

-- Role levels: manage -> rolün org'u için org owner VEYA ekip lideri
drop policy if exists "Role levels manage" on public.role_levels;
create policy "Role levels manage" on public.role_levels for all using (
  exists (
    select 1 from public.roles r
    join public.organizations o on o.id = r.organization_id
    where r.id = role_levels.role_id
      and (o.owner_id = auth.uid()
           or exists (select 1 from public.teams t
                      where t.organization_id = o.id
                        and (t.owner_id = auth.uid()
                             or exists (select 1 from public.team_members tm
                                        where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))))
  )
);

-- Role permissions: manage -> role_level'ın rolünün org'u için org owner VEYA ekip lideri
drop policy if exists "Role permissions manage" on public.role_permissions;
create policy "Role permissions manage" on public.role_permissions for all using (
  exists (
    select 1 from public.role_levels rl
    join public.roles r on r.id = rl.role_id
    join public.organizations o on o.id = r.organization_id
    where rl.id = role_permissions.role_level_id
      and (o.owner_id = auth.uid()
           or exists (select 1 from public.teams t
                      where t.organization_id = o.id
                        and (t.owner_id = auth.uid()
                             or exists (select 1 from public.team_members tm
                                        where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))))
  )
);

-- Member roles: manage -> üyenin org'u için org owner VEYA ekip lideri (üyelere rol atayabilsin)
drop policy if exists "Member roles manage" on public.member_roles;
create policy "Member roles manage" on public.member_roles for all using (
  exists (
    select 1 from public.members m
    join public.organizations o on o.id = m.organization_id
    where m.id = member_roles.member_id
      and (o.owner_id = auth.uid()
           or exists (select 1 from public.teams t
                      where t.organization_id = o.id
                        and (t.owner_id = auth.uid()
                             or exists (select 1 from public.team_members tm
                                        where tm.team_id = t.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'))))
  )
);
