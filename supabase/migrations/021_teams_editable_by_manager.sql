-- Ekip adı düzenleme ve ekip kapatma: is_active alanı + yönetici (owner veya MANAGER) güncelleyebilsin.

alter table public.teams
  add column if not exists is_active boolean not null default true;

comment on column public.teams.is_active is 'false ise ekip kapatılmış; listede gösterilmez.';

-- Owner zaten "Teams update owner" ile güncelleyebiliyor. MANAGER da güncelleyebilsin (ad, is_active).
create policy "Teams update by manager" on public.teams for update using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = teams.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'
  )
);
