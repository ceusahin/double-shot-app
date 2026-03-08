-- Davet kodu ile katılım: Üye olmayan kullanıcı teams tablosunu RLS yüzünden okuyamıyor.
-- Bu RPC SECURITY DEFINER ile takımı bulup kullanıcıyı ekler.

create or replace function public.join_team_by_invite_code(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_team public.teams%rowtype;
  v_org_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Oturum açmanız gerekiyor.';
  end if;

  select id, organization_id into v_team_id, v_org_id
  from public.teams
  where invite_code = upper(trim(p_invite_code))
  limit 1;

  if v_team_id is null then
    raise exception 'Geçersiz davet kodu.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_user_id, 'BARISTA')
  on conflict (team_id, user_id) do nothing;

  if v_org_id is not null then
    begin
      insert into public.members (user_id, organization_id, status)
      values (v_user_id, v_org_id, 'active')
      on conflict (user_id, organization_id) do nothing;
    exception when others then
      null;
    end;
  end if;

  select * into v_team from public.teams where id = v_team_id;
  return row_to_json(v_team);
end;
$$;

-- RPC'yi authenticated kullanıcılar çağırabilsin
grant execute on function public.join_team_by_invite_code(text) to authenticated;
grant execute on function public.join_team_by_invite_code(text) to anon;
