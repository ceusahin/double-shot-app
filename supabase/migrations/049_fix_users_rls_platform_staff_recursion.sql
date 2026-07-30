-- "Platform staff read all users" politikası users üzerinde users'a tekrar SELECT attığı için
-- sonsuz özyineleme (42P17) üretiyordu. Kontrol, RLS dışında security definer fonksiyonla yapılır.

create or replace function public.is_platform_staff_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select (u.is_super_admin or u.is_platform_admin)
      from public.users u
      where u.id = auth.uid()
    ),
    false
  );
$$;

comment on function public.is_platform_staff_member() is 'RLS içinde users self-join döngüsünü önlemek için; platform personeli kontrolü.';

grant execute on function public.is_platform_staff_member() to authenticated;

drop policy if exists "Platform staff read all users" on public.users;

create policy "Platform staff read all users"
on public.users
for select
to authenticated
using ( public.is_platform_staff_member() );
