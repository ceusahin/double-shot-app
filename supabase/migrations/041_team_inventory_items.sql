-- Depo stok yönetimi: kategori + ürün tablosu

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

create table if not exists public.team_inventory_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  category_id uuid not null references public.inventory_categories(id) on delete restrict,
  name text not null,
  unit text not null default 'adet',
  current_qty numeric(10,2) not null default 0 check (current_qty >= 0),
  notes text null,
  created_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_inventory_items_team_category
  on public.team_inventory_items(team_id, category_id, name);

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

alter table public.inventory_categories enable row level security;
alter table public.team_inventory_items enable row level security;

-- Kategori: ekip üyeleri okuyabilir.
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

-- Kategori: sadece owner veya MANAGER CRUD.
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

-- Ürün: ekip üyeleri okuyabilir.
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

-- Ürün insert/delete sadece owner veya MANAGER.
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

-- Ürün update: ekip üyeleri stok miktarını güncelleyebilir.
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
)
);
