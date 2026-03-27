-- Join request içinde requester snapshot alanları.
alter table if exists public.team_join_requests
  add column if not exists requester_name text,
  add column if not exists requester_surname text,
  add column if not exists requester_email text,
  add column if not exists requester_profile_photo text;

-- Eski bekleyen kayıtları users tablosundan doldur.
update public.team_join_requests r
set
  requester_name = u.name,
  requester_surname = u.surname,
  requester_email = u.email,
  requester_profile_photo = u.profile_photo
from public.users u
where r.requester_user_id = u.id
  and (
    r.requester_name is null
    or r.requester_email is null
  );

-- Yeni request oluşturma RPC'sinde snapshot alanlarını da doldur.
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
  where id = v_invite.team_id and coalesce(is_active, true) = true
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

grant execute on function public.request_join_team_by_invite_token(uuid) to authenticated;

