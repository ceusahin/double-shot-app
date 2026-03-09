-- Ekip lideri (owner veya MANAGER), takımın organization_id alanı henüz set edilmemişse
-- güncelleyebilsin (ensureOrganizationForTeam akışı için).
-- Mevcut "Teams update owner" sadece owner'a izin veriyor; bazen update başka sebeplerle reddedilebiliyor.
-- Bu policy, organization_id null iken ekip liderinin güncellemesine izin verir.

create policy "Teams update org by leader when null" on public.teams for update using (
  organization_id is null
  and (
    owner_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = teams.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'
    )
  )
);
