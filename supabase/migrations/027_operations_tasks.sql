-- Operasyon görevleri: bakım takvimi + açılış/kapanış + checkout

create table if not exists public.operation_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  -- null ise tüm takımlar için global şablon
  type text not null check (type in ('maintenance', 'opening', 'closing', 'checkout')),
  label text not null,
  -- maintenance için 0=Pzt ... 6=Paz, diğer tipler için null olabilir
  day_of_week int check (day_of_week between 0 and 6),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_operation_tasks_team_type
  on public.operation_tasks(team_id, type);

alter table public.operation_tasks enable row level security;

-- Ekip üyeleri okuyabilir (global veya kendi takımı için tanımlı görevler)
create policy "Operation tasks read" on public.operation_tasks for select using (
  team_id is null
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = operation_tasks.team_id
      and tm.user_id = auth.uid()
  )
);

-- Yalnızca ekip owner veya MANAGER kendi takımına ait görev tanımı yapabilir.
create policy "Operation tasks manage" on public.operation_tasks
  for all
  using (
    team_id is not null
    and (
      exists (
        select 1 from public.team_members tm
        where tm.team_id = operation_tasks.team_id
          and tm.user_id = auth.uid()
          and tm.role = 'MANAGER'
      )
      or exists (
        select 1 from public.teams t
        where t.id = operation_tasks.team_id
          and t.owner_id = auth.uid()
      )
    )
  )
  with check (
    team_id is not null
    and (
      exists (
        select 1 from public.team_members tm
        where tm.team_id = operation_tasks.team_id
          and tm.user_id = auth.uid()
          and tm.role = 'MANAGER'
      )
      or exists (
        select 1 from public.teams t
        where t.id = operation_tasks.team_id
          and t.owner_id = auth.uid()
      )
    )
  );

