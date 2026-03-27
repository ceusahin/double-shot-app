-- RBAC (member_roles) ile team_members.role (BARISTA / MANAGER) senkronu.
-- Ekip listesi ve yetkiler team_members.role üzerinden okunur.

create or replace function public.sync_team_member_role_with_rbac(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_member_id uuid;
  v_is_manager boolean := false;
begin
  if v_actor is null then
    raise exception 'Giriş yapmalısınız';
  end if;

  if not (
    exists (select 1 from public.teams t where t.id = p_team_id and t.owner_id = v_actor)
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = p_team_id and tm.user_id = v_actor and tm.role = 'MANAGER'
    )
  ) then
    raise exception 'Bu işlem için yetkiniz yok';
  end if;

  -- Takım sahibi her zaman MANAGER satırında kalmalı
  if exists (select 1 from public.teams t where t.id = p_team_id and t.owner_id = p_user_id) then
    update public.team_members
    set role = 'MANAGER'
    where team_id = p_team_id and user_id = p_user_id;
    return;
  end if;

  select t.organization_id into v_org_id
  from public.teams t
  where t.id = p_team_id
  limit 1;

  if v_org_id is null then
    update public.team_members
    set role = 'BARISTA'
    where team_id = p_team_id and user_id = p_user_id;
    return;
  end if;

  select m.id into v_member_id
  from public.members m
  where m.user_id = p_user_id and m.organization_id = v_org_id
  limit 1;

  if v_member_id is null then
    update public.team_members
    set role = 'BARISTA'
    where team_id = p_team_id and user_id = p_user_id;
    return;
  end if;

  select exists (
    select 1
    from public.member_roles mr
    join public.role_permissions rp on rp.role_level_id = mr.role_level_id
    join public.permissions p on p.id = rp.permission_id
    where mr.member_id = v_member_id
      and p.key in ('manage_roles', 'assign_roles')
  ) into v_is_manager;

  update public.team_members
  set role = case when v_is_manager then 'MANAGER' else 'BARISTA' end
  where team_id = p_team_id and user_id = p_user_id;
end;
$$;

grant execute on function public.sync_team_member_role_with_rbac(uuid, uuid) to authenticated;
