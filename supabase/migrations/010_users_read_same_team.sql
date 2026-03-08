-- Aynı takımda olduğunuz kullanıcıların profil bilgilerini (isim, seviye, XP vb.) okuyabilirsiniz.
-- Böylece takım üyeleri listesi / liderlik tablosu doğru şekilde dolar.
create policy "Users read same team" on public.users for select using (
  id = auth.uid()
  or exists (
    select 1 from public.team_members tm1
    join public.team_members tm2 on tm1.team_id = tm2.team_id and tm2.user_id = users.id
    where tm1.user_id = auth.uid()
  )
);
