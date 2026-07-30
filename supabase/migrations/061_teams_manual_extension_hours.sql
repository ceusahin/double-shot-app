-- Teams: toplam manuel uzatma (saat). Super admin RPC her cagrida delta ekler.
-- Pozitif = uzatma, negatif = kisaltma. 0 = manuel ayarlama yok.

alter table public.teams
  add column if not exists manual_extension_hours integer not null default 0;

comment on column public.teams.manual_extension_hours is
  'Super admin tarafindan uygulanan toplam manuel saat delta (pozitif uzatma / negatif kisaltma).';

-- RPC: subscription_ends_at guncellemesine ek olarak manual_extension_hours toplamina da yazar.
create or replace function public.super_admin_extend_team_subscription(
  p_team_id uuid,
  p_hours int
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_finish timestamptz;
  v_next timestamptz;
  v_floor timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;

  if not exists (select 1 from public.users where id = auth.uid() and coalesce(is_super_admin, false) = true) then
    raise exception 'Yetkisiz';
  end if;

  if p_team_id is null then
    raise exception 'Ekip gerekli';
  end if;

  if p_hours is null or p_hours = 0 then
    raise exception 'Saat degeri 0 olamaz';
  end if;

  if p_hours > 87600 or p_hours < -87600 then
    raise exception 'Saat degeri aralik disi';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Ekip bulunamadi';
  end if;

  v_start := (select subscription_started_at from public.teams where id = p_team_id);
  v_finish := (select subscription_ends_at from public.teams where id = p_team_id);

  if v_finish is null then
    raise exception 'Bu ekip icin paket suresi tanimli degil';
  end if;

  v_next := v_finish + (p_hours::text || ' hours')::interval;

  v_floor := coalesce(v_start, now()) + interval '1 hour';
  if v_next < v_floor then
    raise exception 'Sure baslangictan onceye cekilemez';
  end if;

  update public.teams
    set subscription_ends_at = v_next,
        manual_extension_hours = coalesce(manual_extension_hours, 0) + p_hours
    where id = p_team_id;

  return v_next;
end;
$$;

grant execute on function public.super_admin_extend_team_subscription(uuid, int) to authenticated;
