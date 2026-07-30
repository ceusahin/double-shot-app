-- Tür bazlı kota bakiyesi; ekip oluştururken quota_consumed_kind ile düşer.

alter table public.users
  add column if not exists quota_balances jsonb not null default '{}'::jsonb;

comment on column public.users.quota_balances is 'Ekip kurma hakkı: trial_15d, months_1, months_3, months_6 (adet). max_owned_teams = toplam.';

alter table public.teams
  add column if not exists quota_consumed_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'teams' and c.conname = 'teams_quota_consumed_kind_check'
  ) then
    alter table public.teams
      add constraint teams_quota_consumed_kind_check
      check (quota_consumed_kind is null or quota_consumed_kind in ('trial_15d', 'months_1', 'months_3', 'months_6'));
  end if;
end $$;

comment on column public.teams.quota_consumed_kind is 'Bu ekip için hangi kota türünden 1 adet düşüldü (platform/süper için null olabilir).';

create or replace function public.sync_max_owned_teams_from_balances(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s int := 0;
  r record;
begin
  for r in
    select * from jsonb_each_text(
      coalesce((select quota_balances from public.users where id = p_user_id), '{}'::jsonb)
    )
  loop
    s := s + greatest(0, coalesce(r.value::int, 0));
  end loop;
  update public.users set max_owned_teams = least(999, s) where id = p_user_id;
end;
$$;

-- Mevcut: grant sayıları + kalan max → months_1
do $$
declare
  r record;
  agg jsonb;
  gsum int;
  rem int;
  mb int;
  subc bigint;
begin
  for r in select id, coalesce(max_owned_teams, 0) as mx from public.users
  loop
    select count(*) into subc from public.user_quota_grants where user_id = r.id;
    if subc = 0 then
      if r.mx > 0 then
        update public.users set quota_balances = jsonb_build_object('months_1', r.mx) where id = r.id;
        perform public.sync_max_owned_teams_from_balances(r.id);
      end if;
      continue;
    end if;

    select coalesce(jsonb_object_agg(kind, cnt), '{}'::jsonb) into agg
    from (
      select kind, count(*)::int as cnt from public.user_quota_grants where user_id = r.id group by kind
    ) t;

    gsum := 0;
    select coalesce(sum((value::text)::int), 0) into gsum from jsonb_each_text(agg);

    rem := greatest(0, r.mx - gsum);
    if rem > 0 then
      mb := coalesce((agg->>'months_1')::int, 0) + rem;
      agg := jsonb_set(coalesce(agg, '{}'::jsonb), '{months_1}', to_jsonb(mb), true);
    end if;

    update public.users set quota_balances = agg where id = r.id;
    perform public.sync_max_owned_teams_from_balances(r.id);
  end loop;
end $$;

-- Grant: bakiye + audit (max tetikleyicide)
create or replace function public.super_admin_grant_owned_team_quota(p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur int;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not exists (select 1 from public.users where id = auth.uid() and coalesce(is_super_admin, false) = true) then
    raise exception 'Yetkisiz';
  end if;
  if p_kind not in ('trial_15d', 'months_1', 'months_3', 'months_6') then
    raise exception 'Geçersiz kota tipi';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Kullanıcı bulunamadı';
  end if;
  if exists (select 1 from public.users where id = p_user_id and coalesce(is_super_admin, false) = true) then
    raise exception 'Süper yönetici için bu alan kullanılmaz';
  end if;

  cur := coalesce((select (quota_balances->>p_kind)::int from public.users where id = p_user_id), 0);
  update public.users
  set quota_balances = jsonb_set(
    coalesce(quota_balances, '{}'::jsonb),
    array[p_kind],
    to_jsonb(cur + 1)
  )
  where id = p_user_id;

  perform public.sync_max_owned_teams_from_balances(p_user_id);

  insert into public.user_quota_grants (user_id, kind, granted_by)
  values (p_user_id, p_kind, auth.uid());
end;
$$;

create or replace function public.super_admin_revoke_owned_team_quota(p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur int;
  nextv int;
  newb jsonb;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not exists (select 1 from public.users where id = auth.uid() and coalesce(is_super_admin, false) = true) then
    raise exception 'Yetkisiz';
  end if;
  if p_kind not in ('trial_15d', 'months_1', 'months_3', 'months_6') then
    raise exception 'Geçersiz kota tipi';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Kullanıcı bulunamadı';
  end if;
  if exists (select 1 from public.users where id = p_user_id and coalesce(is_super_admin, false) = true) then
    raise exception 'Süper yönetici için bu alan kullanılmaz';
  end if;

  cur := coalesce((select (quota_balances->>p_kind)::int from public.users where id = p_user_id), 0);
  if cur < 1 then
    raise exception 'Bu türde düşürülecek kota yok';
  end if;

  nextv := cur - 1;
  newb := coalesce((select quota_balances from public.users where id = p_user_id), '{}'::jsonb);
  if nextv <= 0 then
    newb := newb #- array[p_kind];
  else
    newb := jsonb_set(newb, array[p_kind], to_jsonb(nextv));
  end if;

  update public.users set quota_balances = newb where id = p_user_id;
  perform public.sync_max_owned_teams_from_balances(p_user_id);
end;
$$;

comment on function public.super_admin_revoke_owned_team_quota(uuid, text) is 'Süper yönetici: seçilen türden 1 kota düşürür.';

grant execute on function public.super_admin_revoke_owned_team_quota(uuid, text) to authenticated;

-- BEFORE INSERT: kota türü + bakiye (platform/süper muaf)
create or replace function public.tg_teams_enforce_owner_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super boolean;
  v_platform boolean;
  v_max int;
  v_owned int;
  v_qb jsonb;
  v_bal int;
  v_kind text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  perform set_config('row_security', 'off', true);

  select
    coalesce(is_super_admin, false),
    coalesce(is_platform_admin, false),
    coalesce(max_owned_teams, 0),
    coalesce(quota_balances, '{}'::jsonb)
  into v_super, v_platform, v_max, v_qb
  from public.users
  where id = new.owner_id;

  if not found then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  if v_super or v_platform then
    return new;
  end if;

  v_kind := new.quota_consumed_kind;
  if v_kind is null or length(trim(v_kind)) = 0 then
    raise exception 'Kota türü (quota_consumed_kind) gerekli';
  end if;

  v_bal := coalesce((v_qb->>v_kind)::int, 0);
  if v_bal < 1 then
    raise exception 'Bu kota türü için kullanılabilir hak yok: %', v_kind;
  end if;

  select count(*)::int into v_owned from public.teams where owner_id = new.owner_id;

  if v_owned >= v_max then
    raise exception 'Ekip oluşturma kotası doldu veya kota atanmadı (max %, mevcut %)', v_max, v_owned;
  end if;

  return new;
end;
$$;

create or replace function public.tg_teams_after_insert_consume_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super boolean;
  v_platform boolean;
  v_kind text;
  cur int;
  nextv int;
  newb jsonb;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  perform set_config('row_security', 'off', true);

  select coalesce(is_super_admin, false), coalesce(is_platform_admin, false)
  into v_super, v_platform
  from public.users where id = new.owner_id;

  if v_super or v_platform then
    return new;
  end if;

  v_kind := new.quota_consumed_kind;
  if v_kind is null then
    return new;
  end if;

  cur := coalesce((select (quota_balances->>v_kind)::int from public.users where id = new.owner_id), 0);
  if cur < 1 then
    raise exception 'Kota düşürme tutarsızlığı';
  end if;

  nextv := cur - 1;
  newb := coalesce((select quota_balances from public.users where id = new.owner_id), '{}'::jsonb);

  if nextv <= 0 then
    newb := newb #- array[v_kind];
  else
    newb := jsonb_set(newb, array[v_kind], to_jsonb(nextv));
  end if;

  update public.users set quota_balances = newb where id = new.owner_id;
  perform public.sync_max_owned_teams_from_balances(new.owner_id);

  return new;
end;
$$;

drop trigger if exists teams_after_insert_consume_quota on public.teams;
create trigger teams_after_insert_consume_quota
  after insert on public.teams
  for each row
  execute procedure public.tg_teams_after_insert_consume_quota();
