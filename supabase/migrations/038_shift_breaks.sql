create table if not exists public.shift_break_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 180),
  created_at timestamptz not null default now()
);

create index if not exists shift_break_templates_team_idx
  on public.shift_break_templates(team_id, created_at desc);

create table if not exists public.shift_break_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  shift_log_id uuid references public.shift_logs(id) on delete set null,
  break_template_id uuid not null references public.shift_break_templates(id) on delete cascade,
  started_at timestamptz not null default now(),
  planned_end_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shift_break_logs_team_active_idx
  on public.shift_break_logs(team_id, started_at desc)
  where ended_at is null;

create index if not exists shift_break_logs_user_started_idx
  on public.shift_break_logs(user_id, started_at desc);

create unique index if not exists shift_break_logs_user_single_active_idx
  on public.shift_break_logs(user_id)
  where ended_at is null;

alter table public.shift_break_templates enable row level security;
alter table public.shift_break_logs enable row level security;

drop policy if exists "Break templates read by team members" on public.shift_break_templates;
create policy "Break templates read by team members" on public.shift_break_templates
for select using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = shift_break_templates.team_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "Break templates write by team owner" on public.shift_break_templates;
create policy "Break templates write by team owner" on public.shift_break_templates
for all using (
  exists (
    select 1
    from public.teams t
    where t.id = shift_break_templates.team_id
      and t.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.teams t
    where t.id = shift_break_templates.team_id
      and t.owner_id = auth.uid()
  )
);

drop policy if exists "Break logs read by team members" on public.shift_break_logs;
create policy "Break logs read by team members" on public.shift_break_logs
for select using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = shift_break_logs.team_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "Break logs insert by team members" on public.shift_break_logs;
create policy "Break logs insert by team members" on public.shift_break_logs
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.team_members tm
    where tm.team_id = shift_break_logs.team_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "Break logs update by owner or self" on public.shift_break_logs;
create policy "Break logs update by owner or self" on public.shift_break_logs
for update using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.teams t
    where t.id = shift_break_logs.team_id
      and t.owner_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.teams t
    where t.id = shift_break_logs.team_id
      and t.owner_id = auth.uid()
  )
);
