-- Bekleyen katılma isteği olan kullanıcılar henüz team_members'ta değil;
-- "Users read same team" onların güncel profil_photo vb. alanlarını göstermiyordu.
-- İsteği görebilen yönetici / ekip sahibi, istek sahibinin canlı profilini okuyabilsin.

drop policy if exists "Users read pending join requesters" on public.users;

create policy "Users read pending join requesters"
on public.users
for select
using (
  exists (
    select 1
    from public.team_join_requests r
    where r.requester_user_id = users.id
      and r.status = 'pending'
      and (
        exists (
          select 1 from public.team_members tm
          where tm.team_id = r.team_id
            and tm.user_id = auth.uid()
            and tm.role = 'MANAGER'
        )
        or exists (
          select 1 from public.teams t
          where t.id = r.team_id
            and t.owner_id = auth.uid()
        )
      )
  )
);
