-- 041'in eski hali çalıştırılmış kurulumlar için geçiş migration'ı.
-- Amaç:
-- 1) inventory_categories tablosunu eklemek
-- 2) team_inventory_items.category(text) -> category_id(uuid) ilişkisinin kurulması
-- 3) kategori bazlı min_alert_qty desteği
-- 4) yeni RLS politikalarına geçiş

-- 1) Kategori tablosu
create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  min_alert_qty numeric(10,2) not null default 0 check (min_alert_qty >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_inventory_categories_team_name
  on public.inventory_categories(team_id, lower(name));

create index if not exists idx_inventory_categories_team_sort
  on public.inventory_categories(team_id, sort_order, created_at);

-- 2) team_inventory_items'e category_id ekle
alter table public.team_inventory_items
  add column if not exists category_id uuid;

-- Eski category(text) alanı varsa mevcut verileri kategorilere taşı.
with distinct_categories as (
  select
    ti.team_id,
    nullif(trim(ti.category), '') as raw_name
  from public.team_inventory_items ti
  group by ti.team_id, nullif(trim(ti.category), '')
),
normalized_categories as (
  select
    team_id,
    coalesce(raw_name, 'Genel') as name
  from distinct_categories
)
insert into public.inventory_categories (team_id, name, min_alert_qty, sort_order)
select
  nc.team_id,
  nc.name,
  0,
  row_number() over (partition by nc.team_id order by lower(nc.name)) - 1
from normalized_categories nc
on conflict (team_id, lower(name)) do nothing;

-- Her takımda en az bir kategori olsun (boş stokta da not null için gerekli).
insert into public.inventory_categories (team_id, name, min_alert_qty, sort_order)
select
  t.id,
  'Genel',
  0,
  0
from public.teams t
where not exists (
  select 1
  from public.inventory_categories c
  where c.team_id = t.id
)
on conflict (team_id, lower(name)) do nothing;

-- category_id'leri doldur (eski text category üzerinden)
update public.team_inventory_items ti
set category_id = c.id
from public.inventory_categories c
where c.team_id = ti.team_id
  and lower(c.name) = lower(coalesce(nullif(trim(ti.category), ''), 'Genel'))
  and ti.category_id is null;

-- Hala null kalan varsa takımın ilk kategorisine bağla
update public.team_inventory_items ti
set category_id = fallback.id
from (
  select distinct on (team_id) id, team_id
  from public.inventory_categories
  order by team_id, sort_order asc, created_at asc
) as fallback
where ti.team_id = fallback.team_id
  and ti.category_id is null;

-- FK ekle (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_team_inventory_items_category_id'
  ) then
    alter table public.team_inventory_items
      add constraint fk_team_inventory_items_category_id
      foreign key (category_id)
      references public.inventory_categories(id)
      on delete restrict;
  end if;
end $$;

-- Artık zorunlu alan
alter table public.team_inventory_items
  alter column category_id set not null;

create index if not exists idx_team_inventory_items_team_category
  on public.team_inventory_items(team_id, category_id, name);

-- 3) updated_at trigger (eski 041'de vardı, yine idempotent bırakıyoruz)
create or replace function public.touch_team_inventory_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_team_inventory_items_updated_at on public.team_inventory_items;
create trigger trg_touch_team_inventory_items_updated_at
before update on public.team_inventory_items
for each row
execute function public.touch_team_inventory_items_updated_at();

-- 4) RLS / Policy güncellemesi
alter table public.inventory_categories enable row level security;
alter table public.team_inventory_items enable row level security;

-- Eski policy isimlerini temizle (041 ilk sürümden)
drop policy if exists "Inventory read" on public.team_inventory_items;
drop policy if exists "Inventory insert manage" on public.team_inventory_items;
drop policy if exists "Inventory update manage" on public.team_inventory_items;
drop policy if exists "Inventory delete manage" on public.team_inventory_items;

-- Kategori policy'leri
drop policy if exists "Inventory categories read" on public.inventory_categories;
drop policy if exists "Inventory categories insert manage" on public.inventory_categories;
drop policy if exists "Inventory categories update manage" on public.inventory_categories;
drop policy if exists "Inventory categories delete manage" on public.inventory_categories;

create policy "Inventory categories read"
on public.inventory_categories
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = inventory_categories.team_id
      and tm.user_id = auth.uid()
  )
);

create policy "Inventory categories insert manage"
on public.inventory_categories
for insert
with check (
  exists (
    select 1
    from public.teams t
    where t.id = inventory_categories.team_id
      and t.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = inventory_categories.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
);

create policy "Inventory categories update manage"
on public.inventory_categories
for update
using (
  exists (
    select 1
    from public.teams t
    where t.id = inventory_categories.team_id
      and t.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = inventory_categories.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
)
with check (
  exists (
    select 1
    from public.teams t
    where t.id = inventory_categories.team_id
      and t.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = inventory_categories.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
);

create policy "Inventory categories delete manage"
on public.inventory_categories
for delete
using (
  exists (
    select 1
    from public.teams t
    where t.id = inventory_categories.team_id
      and t.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = inventory_categories.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
);

-- Ürün policy'leri (yeni model)
drop policy if exists "Inventory items read" on public.team_inventory_items;
drop policy if exists "Inventory items insert manage" on public.team_inventory_items;
drop policy if exists "Inventory items update qty member" on public.team_inventory_items;
drop policy if exists "Inventory items delete manage" on public.team_inventory_items;

create policy "Inventory items read"
on public.team_inventory_items
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_inventory_items.team_id
      and tm.user_id = auth.uid()
  )
);

create policy "Inventory items insert manage"
on public.team_inventory_items
for insert
with check (
  exists (
    select 1
    from public.teams t
    where t.id = team_inventory_items.team_id
      and t.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_inventory_items.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
);

create policy "Inventory items update qty member"
on public.team_inventory_items
for update
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_inventory_items.team_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_inventory_items.team_id
      and tm.user_id = auth.uid()
  )
);

create policy "Inventory items delete manage"
on public.team_inventory_items
for delete
using (
  exists (
    select 1
    from public.teams t
    where t.id = team_inventory_items.team_id
      and t.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_inventory_items.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'MANAGER'
  )
);
