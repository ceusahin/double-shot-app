create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  invite_token uuid references public.invite_links(token) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create index if not exists team_join_requests_team_status_idx
  on public.team_join_requests(team_id, status, created_at desc);

create unique index if not exists team_join_requests_pending_unique_idx
  on public.team_join_requests(team_id, requester_user_id)
  where status = 'pending';

alter table public.team_join_requests enable row level security;

drop policy if exists "Team join requests read" on public.team_join_requests;
create policy "Team join requests read" on public.team_join_requests
for select
using (
  requester_user_id = auth.uid()
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_join_requests.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
  or exists (
    select 1
    from public.teams t
    where t.id = team_join_requests.team_id
      and t.owner_id = auth.uid()
  )
);

drop policy if exists "Team join requests update by managers" on public.team_join_requests;
create policy "Team join requests update by managers" on public.team_join_requests
for update
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_join_requests.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
  or exists (
    select 1
    from public.teams t
    where t.id = team_join_requests.team_id
      and t.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_join_requests.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
  or exists (
    select 1
    from public.teams t
    where t.id = team_join_requests.team_id
      and t.owner_id = auth.uid()
  )
);

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

  insert into public.team_join_requests (team_id, requester_user_id, invite_token, status)
  values (v_team.id, v_user, p_token, 'pending');

  return v_team;
end;
$$;

create or replace function public.resolve_team_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.team_join_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'Giris yapmalisiniz';
  end if;

  select * into v_req
  from public.team_join_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Istek bulunamadi';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Istek zaten sonuclanmis';
  end if;

  if not (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = v_req.team_id
        and tm.user_id = v_actor
        and tm.role = 'MANAGER'
    )
    or exists (
      select 1
      from public.teams t
      where t.id = v_req.team_id
        and t.owner_id = v_actor
    )
  ) then
    raise exception 'Bu istek icin yetkiniz yok';
  end if;

  if p_approve then
    insert into public.team_members (team_id, user_id, role)
    values (v_req.team_id, v_req.requester_user_id, 'BARISTA')
    on conflict do nothing;
  end if;

  update public.team_join_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      resolved_at = now(),
      resolved_by = v_actor
  where id = v_req.id;
end;
$$;

grant execute on function public.request_join_team_by_invite_token(uuid) to authenticated;
grant execute on function public.resolve_team_join_request(uuid, boolean) to authenticated;
