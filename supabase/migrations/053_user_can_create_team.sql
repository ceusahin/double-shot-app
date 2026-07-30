-- Takım oluşturma: varsayılan kapalı; süper yönetici kullanıcıya özel açabilir.
-- Mevcut ekip sahipleri ve platform personeli kesinti yaşamasın.

alter table public.users
  add column if not exists can_create_team boolean not null default false;

comment on column public.users.can_create_team is 'Takım oluşturma izni; süper yönetici atar. Süper/platform yöneticisi RLS ile doğrudan oluşturabilir.';

-- Mevcut ekip sahipleri
update public.users u
set can_create_team = true
where exists (select 1 from public.teams t where t.owner_id = u.id);

-- Platform personeli (operasyon)
update public.users
set can_create_team = true
where is_super_admin = true or is_platform_admin = true;

-- teams insert: izin veya yönetici rolleri
drop policy if exists "Teams insert" on public.teams;
create policy "Teams insert"
on public.teams
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (
        u.can_create_team = true
        or u.is_super_admin = true
        or u.is_platform_admin = true
      )
  )
);

create or replace function public.super_admin_set_can_create_team(p_user_id uuid, p_allowed boolean)
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
  if exists (select 1 from public.users where id = p_user_id and is_super_admin = true) then
    raise exception 'Süper yönetici için bu alan kullanılmaz';
  end if;
  update public.users
  set can_create_team = p_allowed
  where id = p_user_id;
end;
$$;

comment on function public.super_admin_set_can_create_team(uuid, boolean) is 'Süper yönetici, kullanıcıya takım oluşturma izni verir/alır.';

grant execute on function public.super_admin_set_can_create_team(uuid, boolean) to authenticated;
