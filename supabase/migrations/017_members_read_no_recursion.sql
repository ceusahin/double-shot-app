-- Members read policy kendi tablosuna (members) referans veriyordu -> infinite recursion.
-- Erişimi organizations + teams + team_members ile tanımlayalım; members'a referans yok.

drop policy if exists "Members read" on public.members;
create policy "Members read" on public.members for select using (
  exists (select 1 from public.organizations where id = members.organization_id and owner_id = auth.uid())
  or exists (
    select 1 from public.teams t
    where t.organization_id = members.organization_id
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id = auth.uid()))
  )
);
