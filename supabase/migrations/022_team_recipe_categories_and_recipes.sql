-- Ekip tarifleri: çalışma alanına göre kategoriler (Mutfak, Bar vb.) ve ekip tarifleri (fotoğraf + adım adım).

-- Kategoriler (Mutfak, Bar vb.)
create table if not exists public.team_recipe_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_team_recipe_categories_team on public.team_recipe_categories(team_id);

-- Ekip tarifleri (kategoriye bağlı, fotoğraf + adımlar)
create table if not exists public.team_recipes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  category_id uuid not null references public.team_recipe_categories(id) on delete cascade,
  name text not null,
  description text,
  steps jsonb not null default '[]',
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_recipes_team on public.team_recipes(team_id);
create index if not exists idx_team_recipes_category on public.team_recipes(category_id);

alter table public.team_recipe_categories enable row level security;
alter table public.team_recipes enable row level security;

-- Kategoriler: ekip üyeleri okuyabilir; owner/manager yönetir
create policy "Team recipe categories read" on public.team_recipe_categories for select using (
  exists (select 1 from public.team_members where team_id = team_recipe_categories.team_id and user_id = auth.uid())
  or exists (select 1 from public.teams where id = team_recipe_categories.team_id and owner_id = auth.uid())
);

create policy "Team recipe categories manage" on public.team_recipe_categories for all using (
  exists (select 1 from public.team_members where team_id = team_recipe_categories.team_id and user_id = auth.uid() and role = 'MANAGER')
  or exists (select 1 from public.teams where id = team_recipe_categories.team_id and owner_id = auth.uid())
);

-- Ekip tarifleri: ekip üyeleri okuyabilir; owner/manager yönetir
create policy "Team recipes read" on public.team_recipes for select using (
  exists (select 1 from public.team_members where team_id = team_recipes.team_id and user_id = auth.uid())
  or exists (select 1 from public.teams where id = team_recipes.team_id and owner_id = auth.uid())
);

create policy "Team recipes manage" on public.team_recipes for all using (
  exists (select 1 from public.team_members where team_id = team_recipes.team_id and user_id = auth.uid() and role = 'MANAGER')
  or exists (select 1 from public.teams where id = team_recipes.team_id and owner_id = auth.uid())
);

comment on table public.team_recipe_categories is 'Ekip tarif kategorileri (Mutfak, Bar vb.)';
comment on table public.team_recipes is 'Ekip tarifleri; kategoriye göre, fotoğraf ve adımlar ile';
