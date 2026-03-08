-- Yönetici/owner ekip bildirimi oluşturabilir (vardiya bildirimi vb.)
create policy "Notifications insert manager" on public.notifications for insert with check (
  exists (select 1 from public.team_members where team_id = notifications.team_id and user_id = auth.uid() and role = 'MANAGER')
  or exists (select 1 from public.teams where id = notifications.team_id and owner_id = auth.uid())
);
