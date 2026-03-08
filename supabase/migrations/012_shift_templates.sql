-- Vardiya tanımları: owner isim ve saat aralığı verir (örn. Gündüz 09:00–17:00)
create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shift_templates_team on public.shift_templates(team_id);

alter table public.shift_templates enable row level security;

-- Ekip üyeleri okuyabilir; sadece yönetici/owner ekleyebilir güncelleyebilir silebilir
create policy "Shift templates read" on public.shift_templates for select using (
  exists (select 1 from public.team_members where team_id = shift_templates.team_id and user_id = auth.uid())
  or exists (select 1 from public.teams where id = shift_templates.team_id and owner_id = auth.uid())
);

create policy "Shift templates manage" on public.shift_templates for all
  using (
    exists (select 1 from public.team_members where team_id = shift_templates.team_id and user_id = auth.uid() and role = 'MANAGER')
    or exists (select 1 from public.teams where id = shift_templates.team_id and owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.team_members where team_id = shift_templates.team_id and user_id = auth.uid() and role = 'MANAGER')
    or exists (select 1 from public.teams where id = shift_templates.team_id and owner_id = auth.uid())
  );

-- Shifts tablosuna şablon bağlantısı (opsiyonel)
alter table public.shifts
  add column if not exists shift_template_id uuid references public.shift_templates(id) on delete set null;

comment on table public.shift_templates is 'Vardiya tanımları: isim + günlük başlangıç/bitiş saati. Bu şablonlara çalışan atanır.';
