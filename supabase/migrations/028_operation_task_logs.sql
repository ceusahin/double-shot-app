-- Operasyon görev logları: tüm ekip aynı checklist durumunu görsün

create table if not exists public.operation_task_logs (
  id uuid primary key default gen_random_uuid(),
  operation_task_id uuid not null references public.operation_tasks(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  log_date date not null,
  completed_at timestamptz not null default now(),
  unique (operation_task_id, team_id, log_date)
);

alter table public.operation_task_logs enable row level security;

-- Aynı takımın tüm üyeleri logları okuyabilir
create policy "Operation task logs read" on public.operation_task_logs
  for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = operation_task_logs.team_id
        and tm.user_id = auth.uid()
    )
  );

-- Takım üyeleri kendi vardiyalarında tamamlandı bilgisini işleyebilir
create policy "Operation task logs insert" on public.operation_task_logs
  for insert
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = operation_task_logs.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "Operation task logs delete" on public.operation_task_logs
  for delete
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = operation_task_logs.team_id
        and tm.user_id = auth.uid()
    )
  );

