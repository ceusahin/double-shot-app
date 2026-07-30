-- Ekip silme: yumuşak kapatma (is_active = false) yerine teams satırının kalıcı silinmesi.
-- İlgili tablolar teams(id) üzerinde ON DELETE CASCADE ile temizlenir.

-- Join isteği RPC: is_active kaldırılmadan önce kontrolü kaldır (kolon düşecek).
create or replace function public.request_join_team_by_invite_token(p_token uuid)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invite_links%rowtype;
  v_team public.teams%rowtype;
  v_requester public.users%rowtype;
begin
  if v_user is null then
    raise exception 'Giris yapmalisiniz';
  end if;

  select * into v_invite
  from public.invite_links
  where token = p_token
  limit 1;

  if not found then
    raise exception 'Gecersiz davet linki';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Davet linkinin suresi dolmus';
  end if;

  select * into v_team
  from public.teams
  where id = v_invite.team_id
  limit 1;

  if not found then
    raise exception 'Ekip bulunamadi';
  end if;

  if exists (
    select 1 from public.team_members tm
    where tm.team_id = v_team.id and tm.user_id = v_user
  ) then
    raise exception 'Bu ekibin zaten uyesisiniz';
  end if;

  if exists (
    select 1 from public.team_join_requests r
    where r.team_id = v_team.id
      and r.requester_user_id = v_user
      and r.status = 'pending'
  ) then
    raise exception 'Bu ekip icin zaten bekleyen bir isteginiz var';
  end if;

  select * into v_requester
  from public.users
  where id = v_user
  limit 1;

  insert into public.team_join_requests (
    team_id,
    requester_user_id,
    requester_name,
    requester_surname,
    requester_email,
    requester_profile_photo,
    invite_token,
    status
  )
  values (
    v_team.id,
    v_user,
    v_requester.name,
    v_requester.surname,
    v_requester.email,
    v_requester.profile_photo,
    p_token,
    'pending'
  );

  return v_team;
end;
$$;

-- Eski yumuşak kapatılmış ekipleri temizle (kolon yoksa atla — bazı ortamlarda 021 hiç uygulanmamış olabilir)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teams'
      and column_name = 'is_active'
  ) then
    delete from public.teams where coalesce(is_active, true) = false;
  end if;
end $$;

-- Sahip veya MANAGER doğrudan ekip silebilsin (istemci: closeTeam → delete)
drop policy if exists "Teams delete by owner or manager" on public.teams;
create policy "Teams delete by owner or manager"
on public.teams
for delete
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = teams.id and tm.user_id = auth.uid() and tm.role = 'MANAGER'
  )
);

-- Platform personeli: kalıcı sil
create or replace function public.platform_staff_close_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not (select public.is_platform_staff_member()) then
    raise exception 'Yetkisiz';
  end if;
  delete from public.teams
  where id = p_team_id;
end;
$$;

comment on function public.platform_staff_close_team(uuid) is 'Platform personeli ekip kaydını kalıcı siler (CASCADE).';

alter table public.teams drop column if exists is_active;
