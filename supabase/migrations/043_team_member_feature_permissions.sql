create table if not exists public.team_member_feature_permissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  feature_key text not null check (
    feature_key in (
      'team_management',
      'shift_management',
      'timesheet_management',
      'shift_location_management',
      'shortage_list',
      'shot_notification',
      'inventory_management'
    )
  ),
  created_at timestamptz not null default now(),
  unique(team_id, user_id, feature_key)
);

create index if not exists team_member_feature_permissions_team_user_idx
  on public.team_member_feature_permissions(team_id, user_id);

alter table public.team_member_feature_permissions enable row level security;

drop policy if exists "Member feature permissions read by team members" on public.team_member_feature_permissions;
create policy "Member feature permissions read by team members"
on public.team_member_feature_permissions
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_member_feature_permissions.team_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "Member feature permissions manage by manager" on public.team_member_feature_permissions;
create policy "Member feature permissions manage by manager"
on public.team_member_feature_permissions
for all
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_member_feature_permissions.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
  or exists (
    select 1
    from public.teams t
    where t.id = team_member_feature_permissions.team_id
      and t.owner_id = auth.uid()
  )
)
with check (
  (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = team_member_feature_permissions.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'MANAGER'
    )
    or exists (
      select 1
      from public.teams t
      where t.id = team_member_feature_permissions.team_id
        and t.owner_id = auth.uid()
    )
  )
  and exists (
    select 1
    from public.team_members target_tm
    where target_tm.team_id = team_member_feature_permissions.team_id
      and target_tm.user_id = team_member_feature_permissions.user_id
  )
);
