-- Organizations read policy "members" tablosuna bakıyordu; members read ise organizations'a
-- bakıyordu -> infinite recursion. Erişimi sadece owner + teams/team_members ile tanımlayalım.

drop policy if exists "Organizations read" on public.organizations;
create policy "Organizations read" on public.organizations for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.teams t
    where t.organization_id = organizations.id
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid()))
  )
);
