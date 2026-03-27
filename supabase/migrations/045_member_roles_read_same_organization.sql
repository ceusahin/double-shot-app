-- Ekip/organizasyon uyeleri birbirlerinin atanmis rollerini gorebilsin.
-- Bu sayede ekip listesinde dinamik ozel rol adlari tum uye tarafinda da tutarli gorunur.
drop policy if exists "Member roles read" on public.member_roles;
create policy "Member roles read"
on public.member_roles
for select
using (
  exists (
    select 1
    from public.members m
    where m.id = member_roles.member_id
      and exists (
        select 1
        from public.members me
        where me.organization_id = m.organization_id
          and me.user_id = auth.uid()
          and me.status = 'active'
      )
  )
  or exists (
    select 1
    from public.members m
    join public.organizations o on o.id = m.organization_id
    where m.id = member_roles.member_id
      and o.owner_id = auth.uid()
  )
);
