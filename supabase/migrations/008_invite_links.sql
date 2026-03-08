-- Süreli davet linki: Kod yerine link; yönetici süre belirleyip link oluşturur.

create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists invite_links_token_idx on public.invite_links(token);
create index if not exists invite_links_expires_at_idx on public.invite_links(expires_at);

alter table public.invite_links enable row level security;

-- Sadece kendi oluşturduğu linkleri veya ekip sahibi tüm ekip linklerini görebilir (opsiyonel; uygulama RPC kullanacak)
create policy "Invite links read own team" on public.invite_links for select using (
  created_by = auth.uid() or exists (select 1 from public.teams where id = invite_links.team_id and owner_id = auth.uid())
);

-- Sadece ekip sahibi link oluşturabilir
create policy "Invite links insert owner" on public.invite_links for insert with check (
  exists (select 1 from public.teams where id = team_id and owner_id = auth.uid())
);

-- RPC: Süreli davet linki oluştur (sadece ekip sahibi)
create or replace function public.create_team_invite_link(p_team_id uuid, p_expires_in_minutes int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_links%rowtype;
  v_link text;
begin
  if auth.uid() is null then
    raise exception 'Oturum açmanız gerekiyor.';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id and owner_id = auth.uid()) then
    raise exception 'Sadece ekip yöneticisi davet linki oluşturabilir.';
  end if;

  if p_expires_in_minutes is null or p_expires_in_minutes < 1 or p_expires_in_minutes > 10080 then
    raise exception 'Süre 1 dakika ile 10080 dakika (7 gün) arasında olmalıdır.';
  end if;

  insert into public.invite_links (team_id, expires_at, created_by)
  values (p_team_id, now() + (p_expires_in_minutes || ' minutes')::interval, auth.uid())
  returning * into v_row;

  v_link := 'doubleshot://invite/' || v_row.token::text;

  return json_build_object(
    'token', v_row.token,
    'expires_at', v_row.expires_at,
    'link', v_link
  );
end;
$$;

-- RPC: Davet linki (token) ile ekibe katıl
create or replace function public.join_team_by_invite_token(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invite_links%rowtype;
  v_team public.teams%rowtype;
  v_org_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Oturum açmanız gerekiyor.';
  end if;

  select * into v_invite from public.invite_links where token = p_token limit 1;

  if v_invite.id is null then
    raise exception 'Geçersiz davet linki.';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Bu davet linkinin süresi dolmuş. Yöneticinizden yeni bir link isteyin.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_invite.team_id, v_user_id, 'BARISTA')
  on conflict (team_id, user_id) do nothing;

  select organization_id into v_org_id from public.teams where id = v_invite.team_id;

  if v_org_id is not null then
    begin
      insert into public.members (user_id, organization_id, status)
      values (v_user_id, v_org_id, 'active')
      on conflict (user_id, organization_id) do nothing;
    exception when others then
      null;
    end;
  end if;

  select * into v_team from public.teams where id = v_invite.team_id;
  return row_to_json(v_team);
end;
$$;

grant execute on function public.create_team_invite_link(uuid, int) to authenticated;
grant execute on function public.join_team_by_invite_token(uuid) to authenticated;
grant execute on function public.join_team_by_invite_token(uuid) to anon;
