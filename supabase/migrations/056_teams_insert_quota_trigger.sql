-- Teams INSERT politikası hâlâ users/teams ile RLS döngüsü üretebiliyor.
-- Çözüm: INSERT politikası yalnızca sahip kontrolü; kota BEFORE INSERT tetikleyicisinde (RLS kapalı sayım).

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
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  -- RLS, SECURITY DEFINER içinde bile oturum kullanıcısına uygulanır; sayım döngüye girebilir.
  perform set_config('row_security', 'off', true);

  select coalesce(is_super_admin, false), coalesce(is_platform_admin, false), coalesce(max_owned_teams, 0)
    into v_super, v_platform, v_max
  from public.users
  where id = new.owner_id;

  if not found then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  if v_super or v_platform then
    return new;
  end if;

  select count(*)::int into v_owned from public.teams where owner_id = new.owner_id;

  if v_owned >= v_max then
    raise exception 'Ekip oluşturma kotası doldu veya kota atanmadı (max %, mevcut %)', v_max, v_owned;
  end if;

  return new;
end;
$$;

drop trigger if exists teams_enforce_owner_quota on public.teams;
create trigger teams_enforce_owner_quota
  before insert on public.teams
  for each row
  execute procedure public.tg_teams_enforce_owner_quota();

comment on function public.tg_teams_enforce_owner_quota() is 'Sahip kota kontrolü; RLS döngüsünü önlemek için tetikleyicide sayılır.';

-- Politika: sadece kendi adına ekip oluşturma (kota tetikleyicide)
drop policy if exists "Teams insert" on public.teams;
create policy "Teams insert"
on public.teams
for insert
to authenticated
with check (owner_id = auth.uid());
