-- Platform yönetimi: süper yönetici ve uygulama içi yönetici rolleri.

alter table public.users
  add column if not exists is_super_admin boolean not null default false;

alter table public.users
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.users.is_super_admin is 'Tüm kullanıcıları okuyabilir; platform yöneticisi atayabilir (manuel atanır).';
comment on column public.users.is_platform_admin is 'Yönetim sekmesine erişir; süper yönetici tarafından atanır.';

-- Platform personeli tüm kullanıcı satırlarını okuyabilsin (yönetim ekranları).
drop policy if exists "Platform staff read all users" on public.users;
create policy "Platform staff read all users"
on public.users
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (u.is_super_admin = true or u.is_platform_admin = true)
  )
);

-- Süper yönetici: başka kullanıcıya platform yöneticisi rolü ver / al (RPC ile).
create or replace function public.promote_user_to_platform_admin(p_user_id uuid)
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
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Kullanıcı bulunamadı';
  end if;
  update public.users
  set is_platform_admin = true
  where id = p_user_id
    and is_super_admin = false;
end;
$$;

create or replace function public.revoke_platform_admin(p_user_id uuid)
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
  if p_user_id = auth.uid() then
    raise exception 'Kendi hesabınızı kaldıramazsınız';
  end if;
  update public.users
  set is_platform_admin = false
  where id = p_user_id
    and is_super_admin = false;
end;
$$;

grant execute on function public.promote_user_to_platform_admin(uuid) to authenticated;
grant execute on function public.revoke_platform_admin(uuid) to authenticated;

-- İlk süper yönetici ataması (migration sonrası bir kez, Supabase SQL Editor):
-- update public.users set is_super_admin = true where email = 'ornek@alanadi.com';
