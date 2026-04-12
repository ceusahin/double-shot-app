-- Eksik listesi (shortages) ve alınan ürünler (shortage_fulfilled)

create table if not exists public.shortages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  area text not null, -- Örn: 'Bar', 'Mutfak'
  name text not null,
  created_by uuid not null references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shortages_team_area
  on public.shortages(team_id, area);

create table if not exists public.shortage_fulfilled (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  area text not null,
  name text not null,
  fulfilled_by uuid not null references public.users(id) on delete set null,
  fulfilled_at timestamptz not null default now()
);

create index if not exists idx_shortage_fulfilled_team_area
  on public.shortage_fulfilled(team_id, area, fulfilled_at desc);

alter table public.shortages enable row level security;
alter table public.shortage_fulfilled enable row level security;

-- Tüm takım üyeleri eksik listesini görebilir ve yeni eksik ekleyebilir.
create policy "Shortages read" on public.shortages
  for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = shortages.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "Shortages insert" on public.shortages
  for insert
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = shortages.team_id
        and tm.user_id = auth.uid()
    )
  );

-- Eksik kapatma (silme), sadece ekip lideri veya MANAGER
create policy "Shortages delete manage" on public.shortages
  for delete
  using (
    exists (
      select 1 from public.teams t
      where t.id = shortages.team_id
        and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = shortages.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'MANAGER'
    )
  );

-- Alınanlar listesini tüm takım üyeleri görebilsin.
create policy "Shortage fulfilled read" on public.shortage_fulfilled
  for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = shortage_fulfilled.team_id
        and tm.user_id = auth.uid()
    )
  );

-- Alınanlar kaydı, sadece ekip lideri veya MANAGER
create policy "Shortage fulfilled insert manage" on public.shortage_fulfilled
  for insert
  with check (
    exists (
      select 1 from public.teams t
      where t.id = shortage_fulfilled.team_id
        and t.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = shortage_fulfilled.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'MANAGER'
    )
  );

