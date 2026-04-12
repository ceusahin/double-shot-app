-- Ekip abonelik süresi: paket, faturalama dönemi, başlangıç/bitiş.
-- Uygulama sahibi paneli (Supabase / admin) bu kolonlardan raporlayabilir.
-- Mobil tarafta bitişe ~10 gün kala yerel bildirim tetiklenir.

alter table public.teams
  add column if not exists subscription_plan text
    constraint teams_subscription_plan_check
      check (subscription_plan is null or subscription_plan in ('eco', 'growth', 'scale')),
  add column if not exists subscription_billing_months int
    constraint teams_subscription_billing_months_check
      check (subscription_billing_months is null or subscription_billing_months in (1, 3, 6)),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_ends_at timestamptz;

comment on column public.teams.subscription_plan is 'Satın alınan paket kodu (eco / growth / scale).';
comment on column public.teams.subscription_billing_months is 'Peşin veya aylık dönem: 1, 3 veya 6 ay.';
comment on column public.teams.subscription_started_at is 'Abonelik başlangıç zamanı (oluşturma anı).';
comment on column public.teams.subscription_ends_at is 'Abonelik bitiş zamanı; hatırlatma ve yenileme için.';
