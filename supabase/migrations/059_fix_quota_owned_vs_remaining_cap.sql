-- max_owned_teams, quota_balances toplamıyla senkron (KALAN haklar).
-- Eski "sahip olunan ekip < max" kuralı artık geçersiz: 2 ekip + 1 deneme kotası varken
-- max=1 iken 2>=1 diyerek 3. ekibi yanlışlıkla engelliyordu.
-- Doğru kural: seçilen türde bakiye >= 1 (BEFORE tetikleyicide zaten var); ekstra üst sınır yok.

create or replace function public.tg_teams_enforce_owner_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super boolean;
  v_platform boolean;
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
    coalesce(quota_balances, '{}'::jsonb)
  into v_super, v_platform, v_qb
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

  return new;
end;
$$;

comment on function public.tg_teams_enforce_owner_quota() is
  'Sahip kota: seçilen quota_consumed_kind için bakiye >= 1. max_owned_teams ile sahip sayısı karşılaştırılmaz (kalan hak toplamıdır).';
