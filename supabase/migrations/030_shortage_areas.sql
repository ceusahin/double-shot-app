-- Eksik listesi alanları (ekip lideri tarafından yönetilebilir)

create table if not exists public.shortage_areas (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_shortage_areas_team_name
  on public.shortage_areas(team_id, name);

alter table public.shortage_areas enable row level security;

-- Tüm takım üyeleri alanları görebilir
drop policy if exists "Shortage areas read" on public.shortage_areas;
create policy "Shortage areas read" on public.shortage_areas
  for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = shortage_areas.team_id
        and tm.user_id = auth.uid()
    )
  );

-- Alanları sadece ekip lideri veya MANAGER ekleyebilir
drop policy if exists "Shortage areas insert manage" on public.shortage_areas;
create policy "Shortage areas insert manage" on public.shortage_areas
  for insert
  with check (
    exists (
      select 1 from public.teams t
      where t.id = shortage_areas.team_id
        and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = shortage_areas.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'MANAGER'
    )
  );

-- Alanları sadece ekip lideri veya MANAGER güncelleyip silebilir
drop policy if exists "Shortage areas update manage" on public.shortage_areas;
create policy "Shortage areas update manage" on public.shortage_areas
  for update
  using (
    exists (
      select 1 from public.teams t
      where t.id = shortage_areas.team_id
        and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = shortage_areas.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'MANAGER'
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = shortage_areas.team_id
        and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = shortage_areas.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'MANAGER'
    )
  );

drop policy if exists "Shortage areas delete manage" on public.shortage_areas;
create policy "Shortage areas delete manage" on public.shortage_areas
  for delete
  using (
    exists (
      select 1 from public.teams t
      where t.id = shortage_areas.team_id
        and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = shortage_areas.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'MANAGER'
    )
  );

