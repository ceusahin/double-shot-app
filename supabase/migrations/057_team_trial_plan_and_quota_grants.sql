-- Deneme paketi (trial) + süper yöneticinin süre etiketli kota tanımları

-- teams: trial plan kodu (15 günlük deneme aboneliği)
alter table public.teams drop constraint if exists teams_subscription_plan_check;
alter table public.teams
  add constraint teams_subscription_plan_check
  check (subscription_plan is null or subscription_plan in ('eco', 'growth', 'scale', 'trial'));

comment on column public.teams.subscription_plan is 'eco / growth / scale veya trial (kısa deneme).';

-- Süper yöneticinin kota artırırken seçtiği süre tipi (audit)
create table if not exists public.user_quota_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null
    constraint user_quota_grants_kind_check
    check (kind in ('trial_15d', 'months_1', 'months_3', 'months_6')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.users(id) on delete set null
);

create index if not exists user_quota_grants_user_id_idx on public.user_quota_grants (user_id, granted_at desc);

comment on table public.user_quota_grants is 'Süper yöneticinin süre etiketiyle verdiği ekip kurma kotası artışları (+1).';

alter table public.user_quota_grants enable row level security;

drop policy if exists "Super admin read user_quota_grants" on public.user_quota_grants;
create policy "Super admin read user_quota_grants"
  on public.user_quota_grants
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and coalesce(u.is_super_admin, false) = true
    )
  );

-- Kota +1 ve grant kaydı (süper yönetici)
create or replace function public.super_admin_grant_owned_team_quota(p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  update public.users
  set max_owned_teams = least(999, coalesce(max_owned_teams, 0) + 1)
  where id = p_user_id;

  insert into public.user_quota_grants (user_id, kind, granted_by)
  values (p_user_id, p_kind, auth.uid());
end;
$$;

comment on function public.super_admin_grant_owned_team_quota(uuid, text) is 'Süper yönetici: max_owned_teams +1 ve süre etiketiyle grant kaydı.';

grant execute on function public.super_admin_grant_owned_team_quota(uuid, text) to authenticated;
