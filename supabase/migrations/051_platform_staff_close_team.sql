-- Platform personeli, üye olmadığı ekipleri yönetim ekranından kapatabilsin (is_active = false).
-- Doğrudan teams UPDATE politikası genişletmek yerine security definer RPC ile sınırlı güncelleme.

create or replace function public.platform_staff_close_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if not (select public.is_platform_staff_member()) then
    raise exception 'Yetkisiz';
  end if;
  update public.teams
  set is_active = false
  where id = p_team_id;
end;
$$;

comment on function public.platform_staff_close_team(uuid) is 'Platform personeli ekip kaydını yumuşak siler (is_active = false).';

grant execute on function public.platform_staff_close_team(uuid) to authenticated;
