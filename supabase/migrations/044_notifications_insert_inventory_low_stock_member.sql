-- Ekip üyeleri, sadece depo kritik stok uyarisi tipinde ve ekip sahibini hedefleyerek
-- bildirim olusturabilsin. Diger bildirim tipleri manager/owner policy'sinde kalir.
drop policy if exists "Notifications insert inventory low stock member" on public.notifications;
create policy "Notifications insert inventory low stock member"
on public.notifications
for insert
with check (
  type like 'inventory_low_stock:%'
  and target_user_id is not null
  and exists (
    select 1
    from public.team_members tm
    where tm.team_id = notifications.team_id
      and tm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.teams t
    where t.id = notifications.team_id
      and t.owner_id = notifications.target_user_id
  )
);
