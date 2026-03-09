-- Ekip lideri/yönetici vardiya silebilsin ve güncelleyebilsin
create policy "Shifts update manager" on public.shifts for update using (
  exists (select 1 from public.team_members where team_id = shifts.team_id and user_id = auth.uid() and role = 'MANAGER')
  or exists (select 1 from public.teams where id = shifts.team_id and owner_id = auth.uid())
);
create policy "Shifts delete manager" on public.shifts for delete using (
  exists (select 1 from public.team_members where team_id = shifts.team_id and user_id = auth.uid() and role = 'MANAGER')
  or exists (select 1 from public.teams where id = shifts.team_id and owner_id = auth.uid())
);
