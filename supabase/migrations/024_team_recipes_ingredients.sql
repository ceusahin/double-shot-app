-- Ekip tariflerine kullanılacak malzemeler listesi (açıklamanın altında, hazırlama adımlarının üstünde)
alter table public.team_recipes
  add column if not exists ingredients jsonb not null default '[]';

comment on column public.team_recipes.ingredients is 'Kullanılacak malzemeler listesi (string[])';
