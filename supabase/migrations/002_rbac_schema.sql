-- DOUBLE SHOT - Dynamic RBAC (organizations, roles, permissions)
-- Does NOT drop or overwrite existing tables (users, teams, team_members).

-- 1) Organizations (restaurant / cafe brand)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  subscription_plan text default 'free',
  created_at timestamptz not null default now()
);

-- 2) Add organization link to teams (nullable for backward compatibility)
alter table public.teams add column if not exists organization_id uuid references public.organizations(id) on delete set null;

-- 3) Stores (locations under an organization)
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  latitude double precision,
  longitude double precision,
  radius int,
  created_at timestamptz not null default now()
);

-- 4) Members (user membership in an organization)
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  joined_at timestamptz not null default now(),
  unique(user_id, organization_id)
);

-- 5) Roles (per organization, e.g. Barista, Waiter, Cashier)
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- 6) Role levels (e.g. Junior, Senior, Head Barista)
create table if not exists public.role_levels (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  name text not null,
  level_rank int not null default 0
);

-- 7) Permissions (global catalog; extensible)
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text
);

-- 8) Which permissions a role level has
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_level_id uuid not null references public.role_levels(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  unique(role_level_id, permission_id)
);

-- 9) Member's assigned role + level in this organization
create table if not exists public.member_roles (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  role_level_id uuid not null references public.role_levels(id) on delete cascade,
  assigned_by uuid not null references public.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);

-- 10) Invites (organization-level invite codes)
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invite_code text not null,
  created_by uuid not null references public.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Seed default permissions (idempotent)
insert into public.permissions (key, description) values
  ('create_shift', 'Vardiya oluşturabilir'),
  ('edit_shift', 'Vardiyayı düzenleyebilir'),
  ('delete_shift', 'Vardiyayı silebilir'),
  ('view_reports', 'Raporları görüntüleyebilir'),
  ('send_shot_notification', 'Shot bildirimi gönderebilir'),
  ('manage_training', 'Eğitim modüllerini yönetebilir'),
  ('assign_roles', 'Üyelere rol atayabilir'),
  ('manage_roles', 'Rol ve yetkileri düzenleyebilir')
on conflict (key) do nothing;

-- RLS for new tables
alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.members enable row level security;
alter table public.roles enable row level security;
alter table public.role_levels enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.invites enable row level security;

-- Organizations: owner or member can read; owner can update
create policy "Organizations read" on public.organizations for select using (
  owner_id = auth.uid() or exists (select 1 from public.members where organization_id = organizations.id and user_id = auth.uid())
);
create policy "Organizations insert" on public.organizations for insert with check (owner_id = auth.uid());
create policy "Organizations update" on public.organizations for update using (owner_id = auth.uid());

-- Stores
create policy "Stores read" on public.stores for select using (
  exists (select 1 from public.members where organization_id = stores.organization_id and user_id = auth.uid())
  or exists (select 1 from public.organizations where id = stores.organization_id and owner_id = auth.uid())
);
create policy "Stores manage" on public.stores for all using (
  exists (select 1 from public.organizations where id = stores.organization_id and owner_id = auth.uid())
);

-- Members
create policy "Members read" on public.members for select using (
  exists (select 1 from public.members m where m.organization_id = members.organization_id and m.user_id = auth.uid())
  or exists (select 1 from public.organizations where id = members.organization_id and owner_id = auth.uid())
);
create policy "Members insert" on public.members for insert with check (
  user_id = auth.uid() or exists (select 1 from public.organizations where id = organization_id and owner_id = auth.uid())
);
create policy "Members update" on public.members for update using (
  exists (select 1 from public.organizations where id = members.organization_id and owner_id = auth.uid())
);

-- Roles
create policy "Roles read" on public.roles for select using (
  exists (select 1 from public.members where organization_id = roles.organization_id and user_id = auth.uid())
  or exists (select 1 from public.organizations where id = roles.organization_id and owner_id = auth.uid())
);
create policy "Roles manage" on public.roles for all using (
  exists (select 1 from public.organizations where id = roles.organization_id and owner_id = auth.uid())
);

-- Role levels
create policy "Role levels read" on public.role_levels for select using (
  exists (select 1 from public.roles r join public.organizations o on o.id = r.organization_id
    where r.id = role_levels.role_id and (o.owner_id = auth.uid() or exists (select 1 from public.members where organization_id = o.id and user_id = auth.uid())))
);
create policy "Role levels manage" on public.role_levels for all using (
  exists (select 1 from public.roles r join public.organizations o on o.id = r.organization_id where r.id = role_levels.role_id and o.owner_id = auth.uid())
);

-- Permissions: read for everyone (catalog)
create policy "Permissions read" on public.permissions for select using (true);

-- Role permissions
create policy "Role permissions read" on public.role_permissions for select using (
  exists (select 1 from public.role_levels rl join public.roles r on r.id = rl.role_id join public.organizations o on o.id = r.organization_id
    where rl.id = role_permissions.role_level_id and (o.owner_id = auth.uid() or exists (select 1 from public.members where organization_id = o.id and user_id = auth.uid())))
);
create policy "Role permissions manage" on public.role_permissions for all using (
  exists (select 1 from public.role_levels rl join public.roles r on r.id = rl.role_id join public.organizations o on o.id = r.organization_id
    where rl.id = role_permissions.role_level_id and o.owner_id = auth.uid())
);

-- Member roles
create policy "Member roles read" on public.member_roles for select using (
  exists (select 1 from public.members m join public.organizations o on o.id = m.organization_id
    where m.id = member_roles.member_id and (o.owner_id = auth.uid() or m.user_id = auth.uid()))
);
create policy "Member roles manage" on public.member_roles for all using (
  exists (select 1 from public.members m join public.organizations o on o.id = m.organization_id where m.id = member_roles.member_id and o.owner_id = auth.uid())
);

-- Invites
create policy "Invites read" on public.invites for select using (
  exists (select 1 from public.organizations where id = invites.organization_id and owner_id = auth.uid())
  or exists (select 1 from public.members where organization_id = invites.organization_id and user_id = auth.uid())
);
create policy "Invites manage" on public.invites for all using (
  exists (select 1 from public.organizations where id = invites.organization_id and owner_id = auth.uid())
);

-- Backfill: create one organization per team, link team, create store and members
insert into public.organizations (id, name, owner_id)
select gen_random_uuid(), t.name, t.owner_id
from public.teams t
where t.organization_id is null
limit 0;

-- Use a function to backfill so we can set team.organization_id per row
do $$
declare
  trow record;
  org_id uuid;
begin
  for trow in select id, name, owner_id, store_latitude, store_longitude, store_radius from public.teams where organization_id is null
  loop
    insert into public.organizations (name, owner_id) values (trow.name, trow.owner_id) returning id into org_id;
    update public.teams set organization_id = org_id where id = trow.id;
    insert into public.stores (organization_id, name, latitude, longitude, radius)
    values (org_id, trow.name, trow.store_latitude, trow.store_longitude, trow.store_radius);
    insert into public.members (user_id, organization_id, status)
    select tm.user_id, org_id, 'active' from public.team_members tm where tm.team_id = trow.id
    on conflict (user_id, organization_id) do nothing;
  end loop;
end $$;
