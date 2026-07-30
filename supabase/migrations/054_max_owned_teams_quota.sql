-- Ekip oluşturma kotası: max_owned_teams = sahip olabileceği maksimum ekip sayısı (0 = yok).
-- Önceki can_create_team boolean alanı kaldırılır.
-- NOT: "Teams insert" politikası can_create_team'a bağlı olduğu için önce yeni politika, sonra sütun düşülür.

alter table public.users
  add column if not exists max_owned_teams integer not null default 0;

comment on column public.users.max_owned_teams is 'Sahip olabileceği maksimum ekip sayısı; süper yönetici atar. Süper/platform yöneticisi politikada muaf.';

-- can_create_team varsa veriyi max_owned_teams'e taşı (sütun henüz duruyor)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'can_create_team'
  ) then
    update public.users u
    set max_owned_teams = case
      when u.is_super_admin or u.is_platform_admin then 999
      when u.can_create_team then greatest(
        1,
        coalesce((select count(*)::int from public.teams t where t.owner_id = u.id), 0)
      )
      else 0
    end;
  end if;
end $$;

-- Sütun eklendiyse / üst blok atlandıysa: mevcut ekip sahipleri
update public.users u
set max_owned_teams = greatest(
  max_owned_teams,
  coalesce((select count(*)::int from public.teams t where t.owner_id = u.id), 0)
)
where exists (select 1 from public.teams t where t.owner_id = u.id)
  and max_owned_teams = 0;

update public.users
set max_owned_teams = 999
where is_super_admin = true or is_platform_admin = true;

-- RLS özyinelemesini önlemek için sayım (teams↔team_members); yalnızca auth.uid() için
create or replace function public.count_teams_owned_by(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Geçersiz kullanım';
  end if;
  return (select count(*)::int from public.teams where owner_id = p_user_id);
end;
$$;

comment on function public.count_teams_owned_by(uuid) is 'RLS özyinelemesini önlemek için sahip olunan ekip sayısı; INSERT politikasında kullanılır.';

grant execute on function public.count_teams_owned_by(uuid) to authenticated;

-- Eski politikayı kaldır (can_create_team bağımlılığını kes)
drop policy if exists "Teams insert" on public.teams;
create policy "Teams insert"
on public.teams
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (
        u.is_super_admin = true
        or u.is_platform_admin = true
        or (
          public.count_teams_owned_by(auth.uid()) < coalesce(u.max_owned_teams, 0)
        )
      )
  )
);

-- Artık güvenle düşürülebilir
alter table public.users drop column if exists can_create_team;

drop function if exists public.super_admin_set_can_create_team(uuid, boolean);

create or replace function public.super_admin_set_max_owned_teams(p_user_id uuid, p_max integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not exists (select 1 from public.users where id = auth.uid() and is_super_admin = true) then
    raise exception 'Yetkisiz';
  end if;
  if p_max is null or p_max < 0 or p_max > 999 then
    raise exception 'Kota 0 ile 999 arasında olmalıdır';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Kullanıcı bulunamadı';
  end if;
  if exists (select 1 from public.users where id = p_user_id and is_super_admin = true) then
    raise exception 'Süper yönetici için bu alan kullanılmaz';
  end if;
  update public.users
  set max_owned_teams = p_max
  where id = p_user_id;
end;
$$;

comment on function public.super_admin_set_max_owned_teams(uuid, integer) is 'Süper yönetici, kullanıcının sahip olabileceği max ekip sayısını ayarlar.';

grant execute on function public.super_admin_set_max_owned_teams(uuid, integer) to authenticated;
